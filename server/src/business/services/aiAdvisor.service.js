const expenseRepository = require("../../data/repositories/expense.repository");
const budgetRepository = require("../../data/repositories/budget.repository");
const recurringRuleRepository = require("../../data/repositories/recurringRule.repository");
const conversationRepository = require("../../data/repositories/conversation.repository");
const userRepository = require("../../data/repositories/user.repository");
const logger = require("../../config/logger");
const ApiError = require("../../utils/ApiError");

// Graceful load of Gemini API SDK
let GoogleGenerativeAI;
try {
  const genAI = require("@google/generative-ai");
  GoogleGenerativeAI = genAI.GoogleGenerativeAI;
} catch (e) {
  logger.warn("Google Gen AI package is not installed yet. Rule-based advisor fallback will be active.");
}

/**
 * Service orchestrating financial auditing, score calculation, budget projections,
 * and AI generation using the Google Gemini model or an analytics-driven fallback rule engine.
 */
class AiAdvisorService {
  /**
   * Generates structural financial health profile metrics for the user dashboard.
   * @param {string} userId - Mongoose ObjectId string representing the User.
   * @returns {Promise<Object>} Formatted user financial insights.
   */
  async getInsights(userId) {
    try {
      const userData = await this.compileFinancialContext(userId);
      return {
        healthScore: userData.healthScore,
        risks: userData.risks,
        topSavingOpportunity: userData.topSavingOpportunity,
        spendingTrend: userData.spendingTrend,
        spendingDirection: userData.spendingDirection,
        forecast: userData.forecast,
        summary: {
          totalIncome: userData.totalIncome,
          totalSpent: userData.totalSpent,
          netSavings: userData.netSavings,
          savingsRate: userData.savingsRate,
        },
        categoryBreakdown: userData.categoryBreakdown,
        apiKeyConfigured: !!(process.env.GEMINI_API_KEY && GoogleGenerativeAI),
      };
    } catch (err) {
      logger.error(`Error loading insights for user ${userId}: ${err.message}`);
      throw ApiError.internal("Failed to retrieve advisor insights");
    }
  }

  /**
   * Formulates conversation queries and logs the message stream into Mongoose repository.
   * @param {string} userId - User identifier.
   * @param {string} userMessage - Message query content.
   * @param {Array<Object>} history - Array of previous message contexts.
   * @returns {Promise<Object>} Advisor chat response payload.
   */
  async handleChat(userId, userMessage, history = []) {
    try {
      const convo = await conversationRepository.findOrCreateForUser(userId);
      
      // Persist user query locally
      convo.messages.push({
        sender: "user",
        content: userMessage,
        confidence: 1.0,
        timestamp: new Date(),
      });

      const userData = await this.compileFinancialContext(userId);
      let adviceResult;

      const hasApiKey = !!process.env.GEMINI_API_KEY;
      if (hasApiKey && GoogleGenerativeAI) {
        try {
          adviceResult = await this.callGeminiWithRetry(userData, userMessage, history, 3, 1000, userId);
        } catch (err) {
          logger.error(`Gemini query failed for user ${userId}. Swapping to rule-based analysis fallback: ${err.message}`);
          adviceResult = this.runRuleBasedAdvisor(userData, userMessage);
        }
      } else {
        logger.debug(`Gemini key missing or module load failed. Using fallback rule engine for user ${userId}`);
        adviceResult = this.runRuleBasedAdvisor(userData, userMessage);
      }

      // Persist assistant query locally
      convo.messages.push({
        sender: "assistant",
        content: adviceResult.response,
        confidence: adviceResult.confidence,
        timestamp: new Date(),
      });

      await convo.save();

      return {
        response: adviceResult.response,
        confidence: adviceResult.confidence,
        recommendations: adviceResult.recommendations || [],
        followUpSuggestions: adviceResult.followUpSuggestions || [],
        history: convo.messages,
      };
    } catch (err) {
      logger.error(`Error processing chat message for user ${userId}: ${err.message}`);
      throw ApiError.internal("Failed to generate financial advice response");
    }
  }

  /**
   * Returns conversation message log.
   * @param {string} userId - User identifier.
   * @returns {Promise<Array>} List of chat messages.
   */
  async getHistory(userId) {
    try {
      const convo = await conversationRepository.findOrCreateForUser(userId);
      return convo.messages;
    } catch (err) {
      logger.error(`Error fetching chat history for user ${userId}: ${err.message}`);
      throw ApiError.internal("Failed to retrieve conversation logs");
    }
  }

  /**
   * Clears conversational log.
   * @param {string} userId - User identifier.
   * @returns {Promise<Array>} Truncated message set.
   */
  async clearHistory(userId) {
    try {
      const convo = await conversationRepository.clearMessages(userId);
      return convo.messages;
    } catch (err) {
      logger.error(`Error clearing chat logs for user ${userId}: ${err.message}`);
      throw ApiError.internal("Failed to clear conversational history");
    }
  }

  /**
   * Compiles and evaluates actual user transaction details, budget ceilings, and subscription costs.
   * @param {string} userId - User identifier.
   * @returns {Promise<Object>} Compiled metrics structure.
   */
  async compileFinancialContext(userId) {
    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    // Sum transactions over last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [summary, categoryBreakdown, budgets, recurringRules, paginatedTx, userRecord] = await Promise.all([
      expenseRepository.getSummary(userId, { from: thirtyDaysAgo, to: now }),
      expenseRepository.categoryBreakdown(userId, thirtyDaysAgo, now, "expense"),
      budgetRepository.findAllForUserMonth(userId, currentMonth, currentYear),
      recurringRuleRepository.findAllForUser(userId),
      expenseRepository.findPaginated(userId, { limit: 15, skip: 0 }),
      userRepository.findById(userId),
    ]);

    const userName = userRecord ? userRecord.name : "User";
    const totalIncome = summary ? summary.totalIncome : 0;
    const totalSpent = summary ? summary.totalExpenses : 0;
    const netSavings = totalIncome - totalSpent;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    // Format recent transactions for the AI context
    const recentTxFormatted = paginatedTx && paginatedTx.items.length > 0
      ? paginatedTx.items.map((tx) => {
          const typeLabel = tx.type === "expense" ? "DEBIT" : "CREDIT";
          const catName = tx.category ? tx.category.name : "Uncategorized";
          const dateStr = new Date(tx.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
          const noteStr = tx.note ? ` (Note: "${tx.note}")` : "";
          return `- ${dateStr}: ${typeLabel} of ₹${tx.amount.toLocaleString()} in [${catName}]${noteStr}`;
        }).join("\n")
      : "No recent transactions found.";

    // Evaluate categories concentration
    const totalCategorized = categoryBreakdown.reduce((acc, cat) => acc + cat.total, 0) || 1;
    const mappedCategories = categoryBreakdown.map((cat) => ({
      name: cat.name,
      total: cat.total,
      count: cat.count,
      percentage: (cat.total / totalCategorized) * 100,
    }));

    const topCategory = mappedCategories.length > 0 
      ? mappedCategories[0] 
      : { name: "None", total: 0, percentage: 0 };

    const topSavingOpportunity = topCategory.total > 0 
      ? topCategory.total * 0.15 
      : totalSpent * 0.10;

    // Risks auditing
    const risks = [];
    if (savingsRate < 0) {
      risks.push({
        severity: "CRITICAL",
        title: "Negative Cash Flow",
        description: "Your monthly outflows exceed your total registered inflows.",
        impact: "This spending pattern is unsustainable and leads to debt accumulation.",
      });
    } else if (savingsRate < 10) {
      risks.push({
        severity: "HIGH",
        title: "Very Low Savings Margin",
        description: `Your savings rate is only ${savingsRate.toFixed(1)}%.`,
        impact: "You are vulnerable to sudden financial surprises or emergencies.",
      });
    }

    if (topCategory.percentage > 40) {
      risks.push({
        severity: "HIGH",
        title: "High Category Concentration Risk",
        description: `${topCategory.name} represents ${topCategory.percentage.toFixed(1)}% of your total spending.`,
        impact: "A spike in costs in this single category could heavily destabilize your budget.",
      });
    }

    // Check budget compliance
    let breachedBudgetsCount = 0;
    budgets.forEach((b) => {
      const spent = b.currentSpent || 0;
      const limit = b.limitAmount;
      if (spent > limit) {
        breachedBudgetsCount++;
        risks.push({
          severity: "CRITICAL",
          title: `Budget Breached: ${b.categoryName || "Category"}`,
          description: `You spent ₹${spent.toLocaleString()} which is over your ₹${limit.toLocaleString()} budget.`,
          impact: "Exceeding categorical limits compromises your overall monthly savings goals.",
        });
      } else if (spent / limit >= 0.8) {
        risks.push({
          severity: "MEDIUM",
          title: `Budget Warning: ${b.categoryName || "Category"}`,
          description: `You are at ${((spent / limit) * 100).toFixed(0)}% of your ₹${limit.toLocaleString()} limit.`,
          impact: "High probability of breach before the month ends.",
        });
      }
    });

    // Check subscription overhead
    const activeSubCost = recurringRules
      .filter((r) => r.isActive && r.type === "expense")
      .reduce((acc, r) => acc + r.amount, 0);

    if (activeSubCost > totalIncome * 0.15) {
      risks.push({
        severity: "MEDIUM",
        title: "High Fixed Costs Density",
        description: `Your recurring rules/subscriptions sum to ₹${activeSubCost.toLocaleString()} monthly.`,
        impact: "Locks up flexible liquidity, leaving less room for discretionary adjustments.",
      });
    }

    // Mathematical Health Scoring logic
    let scoreSavings = savingsRate > 30 ? 40 : savingsRate > 0 ? (savingsRate / 30) * 40 : 0;
    let scoreConcentration = topCategory.percentage < 25 ? 30 : topCategory.percentage < 45 ? 20 : 10;
    let scoreBudgets = budgets.length > 0 ? ((budgets.length - breachedBudgetsCount) / budgets.length) * 20 : 20;
    let scoreSubs = activeSubCost < totalIncome * 0.10 ? 10 : activeSubCost < totalIncome * 0.20 ? 5 : 2;
    const healthScore = Math.min(100, Math.max(0, Math.round(scoreSavings + scoreConcentration + scoreBudgets + scoreSubs)));

    // Forecasts projections
    const dailyBurnRate = totalSpent / 30;
    const forecast = {
      "30days": Math.round(dailyBurnRate * 30),
      "60days": Math.round(dailyBurnRate * 60),
      "90days": Math.round(dailyBurnRate * 90),
      warningThreshold: Math.round(totalIncome * 0.95),
    };

    const spendingTrend = totalSpent > 0 ? Math.round((netSavings / (totalIncome || 1)) * 10) : 0;
    const spendingDirection = netSavings >= 0 ? "down" : "up";

    return {
      userName,
      recentTxFormatted,
      totalIncome,
      totalSpent,
      netSavings,
      savingsRate,
      categoryBreakdown: mappedCategories,
      topCategory,
      topSavingOpportunity,
      risks,
      healthScore,
      forecast,
      spendingTrend: Math.abs(spendingTrend),
      spendingDirection,
    };
  }

  /**
   * Safe wrapper around Gemini calling, handling retries with exponential backoff.
   */
  async callGeminiWithRetry(userData, userMessage, history, retries = 3, delayMs = 1000, userId) {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.callGemini(userData, userMessage, history, userId);
      } catch (err) {
        lastError = err;
        logger.warn(`Gemini API call attempt ${attempt}/${retries} failed: ${err.message}. Retrying in ${delayMs}ms...`);
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2; // Exponential backoff scaling
        }
      }
    }
    throw lastError;
  }

  /**
   * Queries Google Gemini API for personalized guidance.
   */
  async callGemini(userData, userMessage, history, userId) {
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const systemInstruction = `You are a highly advanced personal AI Financial Advisor named SpendWise Advisor.
You are embedded directly inside the user's SpendWise expense tracker application. You are not a generic chatbot. You are their dedicated, private financial copilot who has been trained on their actual transactions, cashflows, and budgets.

USER DETAILS:
- Name: ${userData.userName}

USER'S FINANCIAL STATE:
- Total Inflow (Last 30 Days): ₹${userData.totalIncome.toLocaleString()}
- Total Outflow (Last 30 Days): ₹${userData.totalSpent.toLocaleString()}
- Savings Margin: ₹${userData.netSavings.toLocaleString()} (${userData.savingsRate.toFixed(1)}% savings rate)
- Financial Health Score: ${userData.healthScore}/100
- Top Category: ${userData.topCategory.name} (consumes ${userData.topCategory.percentage.toFixed(1)}% of spending)

EXPENSE BREAKDOWN BY CATEGORY:
${userData.categoryBreakdown.map((c) => `- ${c.name}: ₹${c.total.toLocaleString()} (${c.percentage.toFixed(1)}%)`).join("\n")}

RECENT TRANSACTIONS (Use these to mention specific transactions or patterns directly!):
${userData.recentTxFormatted}

ACTIVE RISKS IDENTIFIED:
${userData.risks.map((r) => `- [${r.severity}] ${r.title}: ${r.description} (Impact: ${r.impact})`).join("\n")}

FORECASTED SPEND (Based on current burn rate of ₹${Math.round(userData.totalSpent / 30).toLocaleString()}/day):
- 30-Day projection: ₹${userData.forecast["30days"].toLocaleString()}
- 60-Day projection: ₹${userData.forecast["60days"].toLocaleString()}
- 90-Day projection: ₹${userData.forecast["90days"].toLocaleString()}

GUIDELINES:
1. Address the user by their name (${userData.userName}) occasionally to make it feel personal and conversational.
2. Refer to specific recent transaction names, categories, or notes to prove you have full integration with their transaction history.
3. Be action-oriented (e.g. recommend saving milestones, budget reductions, or subscription prunings).
4. Keep the tone encouraging, professional, friendly, and data-driven. Keep answers structured (use bullet points or headers where needed).`;

    const tools = [{
      functionDeclarations: [
        {
          name: "queryTransactions",
          description: "Retrieve transaction records (expenses/income) for the current user matching filters like date range (from/to), categoryName, type (income/expense), and limit.",
          parameters: {
            type: "OBJECT",
            properties: {
              from: { type: "STRING", description: "Start date in YYYY-MM-DD format" },
              to: { type: "STRING", description: "End date in YYYY-MM-DD format" },
              categoryName: { type: "STRING", description: "Name of the category to filter by (e.g. Food & Dining, Shopping, Health, Bills & Utilities, Transportation, Entertainment, Other)" },
              type: { type: "STRING", enum: ["expense", "income"], description: "Filter by transaction type" },
              limit: { type: "NUMBER", description: "Maximum number of transactions to return (default 50, max 100)" },
            },
          },
        },
        {
          name: "getBudgets",
          description: "Get all budget limits and current spent amounts for the user in a specific month and year.",
          parameters: {
            type: "OBJECT",
            properties: {
              month: { type: "NUMBER", description: "Month number (1 to 12)" },
              year: { type: "NUMBER", description: "Year (YYYY)" },
            },
            required: ["month", "year"],
          },
        },
        {
          name: "getRecurringRules",
          description: "Get all active recurring rules / subscription rules defined by the user.",
          parameters: {
            type: "OBJECT",
            properties: {},
          },
        },
        {
          name: "getAppAnalytics",
          description: "Get financial summary stats (total income, total expense, savings) and category breakdown for a custom date range.",
          parameters: {
            type: "OBJECT",
            properties: {
              from: { type: "STRING", description: "Start date in YYYY-MM-DD format" },
              to: { type: "STRING", description: "End date in YYYY-MM-DD format" },
            },
            required: ["from", "to"],
          },
        },
        {
          name: "getAppMetadata",
          description: "Retrieve app metadata like app name, description, list of pages, available features, tech stack, and charts showing on the analytics dashboard.",
          parameters: {
            type: "OBJECT",
            properties: {},
          },
        },
      ],
    }];

    const model = ai.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction,
      tools: tools
    });
    
    const contents = history.map((msg) => ({
      role: msg.sender === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    contents.push({ role: "user", parts: [{ text: userMessage }] });

    let result = await model.generateContent({
      contents,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.2,
      },
    });

    let responseText = "";

    // Support recursive tool resolution (up to 5 calls)
    let loops = 0;
    while (loops < 5) {
      const functionCalls = result.response.functionCalls();
      if (!functionCalls || functionCalls.length === 0) {
        responseText = result.response.text();
        break;
      }
      
      // Add model's call to the content history
      const parts = functionCalls.map(call => ({ functionCall: call }));
      contents.push({ role: "model", parts });
      
      const responseParts = [];
      for (const call of functionCalls) {
        const { name, args } = call;
        logger.debug(`Gemini requested function call: ${name} with args ${JSON.stringify(args)}`);
        
        let functionResult;
        try {
          functionResult = await this.executeFunction(name, args, userData, userId);
        } catch (execErr) {
          logger.error(`Error executing tool ${name}: ${execErr.message}`);
          functionResult = { error: execErr.message };
        }
        
        responseParts.push({
          functionResponse: {
            name: name,
            response: functionResult
          }
        });
      }
      
      contents.push({ role: "function", parts: responseParts });
      
      // Call model again with the function response included in contents
      result = await model.generateContent({
        contents,
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.2,
        },
      });
      loops++;
    }

    const followUpSuggestions = [];
    if (responseText.toLowerCase().includes("budget")) {
      followUpSuggestions.push("How can I adjust my budgets?");
    }
    if (responseText.toLowerCase().includes("risk") || responseText.toLowerCase().includes("concentration")) {
      followUpSuggestions.push("Tell me more about active risk reduction.");
    }
    if (userData.savingsRate < 10) {
      followUpSuggestions.push("What simple steps can double my savings rate?");
    } else {
      followUpSuggestions.push("Where should I invest my monthly savings surplus?");
    }

    return {
      response: responseText,
      confidence: 0.95,
      followUpSuggestions: followUpSuggestions.slice(0, 3),
    };
  }

  /**
   * Execute actual repository/database queries requested by Gemini.
   */
  async executeFunction(name, args, userData, userId) {
    const categoryRepository = require("../../data/repositories/category.repository");
    switch (name) {
      case "queryTransactions": {
        let categoryId = undefined;
        if (args.categoryName) {
          const categories = await categoryRepository.findAllByUser(userId);
          const matchedCat = categories.find(c => c.name.toLowerCase() === args.categoryName.toLowerCase());
          if (matchedCat) {
            categoryId = matchedCat._id;
          }
        }
        const { from, to, type, limit } = args;
        const result = await expenseRepository.findPaginated(userId, {
          from,
          to,
          category: categoryId,
          type,
          skip: 0,
          limit: limit || 50
        });
        
        return {
          totalCount: result.total,
          transactions: result.items.map(t => ({
            id: t._id,
            amount: t.amount,
            currency: t.currency || "INR",
            type: t.type,
            date: t.date,
            category: t.category ? t.category.name : "Uncategorized",
            note: t.note,
            location: t.location ? t.location.formattedAddress : null
          }))
        };
      }
      
      case "getBudgets": {
        const { month, year } = args;
        const budgets = await budgetRepository.findAllForUserMonth(userId, month, year);
        return {
          budgets: budgets.map(b => ({
            id: b._id,
            categoryName: b.categoryName || (b.category ? b.category.name : "Category"),
            limitAmount: b.limitAmount,
            currentSpent: b.currentSpent || 0,
            isBreached: (b.currentSpent || 0) > b.limitAmount,
            alertSent: b.alertSent
          }))
        };
      }
      
      case "getRecurringRules": {
        const rules = await recurringRuleRepository.findAllForUser(userId);
        return {
          recurringRules: rules.map(r => ({
            id: r._id,
            amount: r.amount,
            type: r.type,
            frequency: r.frequency,
            category: r.categoryName || "Category",
            description: r.description,
            isActive: r.isActive,
            nextDueDate: r.nextDueDate
          }))
        };
      }
      
      case "getAppAnalytics": {
        const { from, to } = args;
        const fromDate = new Date(from);
        const toDate = new Date(to);
        const [summary, breakdown] = await Promise.all([
          expenseRepository.getSummary(userId, { from: fromDate, to: toDate }),
          expenseRepository.categoryBreakdown(userId, fromDate, toDate, "expense")
        ]);
        return {
          dateRange: { from, to },
          summary: {
            totalIncome: summary.totalIncome,
            totalExpenses: summary.totalExpenses,
            netSavings: summary.netSavings,
            savingsRate: summary.totalIncome > 0 ? (summary.netSavings / summary.totalIncome) * 100 : 0
          },
          categoryBreakdown: breakdown.map(b => ({
            categoryName: b.name,
            totalSpent: b.total,
            count: b.count
          }))
        };
      }
      
      case "getAppMetadata": {
        return {
          appName: "SpendWise",
          version: "1.0.0",
          description: "SpendWise is a personal finance tracker application designed to help users track expenses, create and manage budgets, set up recurring transaction rules, get financial health scoring, see geographical spending trends using Google Maps location intelligence, and chat with a dedicated AI Advisor.",
          pages: [
            { name: "Dashboard", description: "Displays financial summary, health score (out of 100), active alerts, spending trend charts, and recent transactions." },
            { name: "Transactions", description: "Allows logging and viewing credit/debit transactions with category, amount, date, location on map, and custom notes." },
            { name: "Budgets", description: "Set spending limits for different categories. Warns users when they reach 80% and breaches at 100%." },
            { name: "Recurring Rules", description: "Set up subscriptions or auto-recurring transactions (monthly, weekly, etc.) that automatically populate." },
            { name: "Analytics", description: "Shows detailed category breakdowns (pie chart) and spending trend lines over time." },
            { name: "AI Advisor", description: "Open-ended conversational chat interface powered by Google Gemini where users can ask questions about their finances, transactions, budgets, or general app features." }
          ],
          availableFeatures: [
            "User Authentication & JWT Tokens",
            "Geospatial location logging on transactions (Google Maps API)",
            "Recurring subscriptions auto-processor (using Redis and BullMQ background queues)",
            "Dynamic Financial Health Scoring",
            "Interactive AI Advisor chatbot with database querying integration"
          ],
          techStack: {
            backend: "Node.js, Express, MongoDB (Mongoose), Redis (BullMQ for background recurring rules checks), Winston logger",
            frontend: "React, Tailwind CSS, Vite, Chart.js"
          }
        };
      }
      
      default:
        throw new Error(`Unknown tool function: ${name}`);
    }
  }

  /**
   * Fallback rule-based analysis algorithm.
   */
  runRuleBasedAdvisor(userData, userMessage) {
    const query = userMessage.toLowerCase();
    let response = "";
    const recommendations = [];
    const followUpSuggestions = [
      "Explain active risks",
      "Give budget adjustment tips",
      "Show subscription analysis",
    ];

    if (query.includes("analyze") || query.includes("spending") || query.includes("expenses") || query.includes("outflow")) {
      response = `Hello ${userData.userName}! Here is a comprehensive breakdown of your spending habits over the last 30 days:
      
- **Total Registered Expenses**: ₹${userData.totalSpent.toLocaleString()}
- **Top Concentration**: Your largest expense area is **${userData.topCategory.name}** which consumes **₹${userData.topCategory.total.toLocaleString()}** (representing **${userData.topCategory.percentage.toFixed(1)}%** of your total outflows).
- **Daily Outflow Velocity**: You are currently burning through **₹${Math.round(userData.totalSpent / 30).toLocaleString()} per day**.

**AI Recommendation**: 
If you cut your spend on **${userData.topCategory.name}** by **15%**, you could immediately save an extra **₹${userData.topSavingOpportunity.toLocaleString()}** this month. I suggest starting by reviewing your last 5 transactions in this category to see what was discretionary.`;
      
      recommendations.push({
        priority: "HIGH",
        title: `Trim ${userData.topCategory.name}`,
        action: `Reduce spending in ${userData.topCategory.name} by 15%`,
        impact: `Extra ₹${userData.topSavingOpportunity.toLocaleString()} monthly savings`,
      });
    } 
    else if (query.includes("save") || query.includes("savings") || query.includes("surplus") || query.includes("margin")) {
      if (userData.savingsRate < 0) {
        response = `Hi ${userData.userName}, your current savings rate is **${userData.savingsRate.toFixed(1)}%** (a monthly deficit of **₹${Math.abs(userData.netSavings).toLocaleString()}**). 
        
To turn your savings positive, we must tackle this step-by-step:
1. **Locate discretionary leaks**: Your category **${userData.topCategory.name}** consumes a massive **${userData.topCategory.percentage.toFixed(0)}%** of your cashflow. This is the first place to prune.
2. **Review budgets**: Double check if you have any category budgets set up. If not, go to the Budgets tab and set strict thresholds.
3. **Control subscriptions**: Look at active subscriptions and recurring expenses. Pruning even one or two rules will create instant breathing space.`;

        recommendations.push({
          priority: "CRITICAL",
          title: "Stop Cash Drain",
          action: "Prune discretionary spending immediately to balance cashflow",
          impact: "Stop account depletion and build baseline reserves",
        });
      } else {
        response = `Hello ${userData.userName}! Your current savings rate is **${userData.savingsRate.toFixed(1)}%** (a monthly surplus of **₹${userData.netSavings.toLocaleString()}**). This is a solid foundation!
        
Here is how to optimize this surplus:
1. **Emergency Reserve**: Aim to build an emergency fund covering at least 3 to 6 months of your daily burn rate (which is currently ₹${Math.round(userData.totalSpent / 30).toLocaleString()}/day). Your targeted reserve should be around **₹${Math.round(userData.totalSpent * 3.5).toLocaleString()}**.
2. **Auto-Transfer**: Set up recurring transfer rules to move 50% of this surplus out of your spending account at the start of each cycle.
3. **Invest the surplus**: Once your emergency fund is locked, redirect the surplus into index mutual funds or high-yield savings goals.`;

        recommendations.push({
          priority: "MEDIUM",
          title: "Build Emergency Fund",
          action: "Lock ₹50k in high-yield reserves",
          impact: "Financial protection against income shocks",
        });
      }
    } 
    else if (query.includes("risk") || query.includes("alert") || query.includes("warning") || query.includes("breach")) {
      if (userData.risks.length === 0) {
        response = `Excellent news, ${userData.userName}! No critical risks or budget breaches have been detected in your recent logs. 
        
Your Financial Health Score is **${userData.healthScore}/100**, indicating stable money habits. Continue keeping track of category boundaries to prevent stealth inflation!`;
      } else {
        response = `Hi ${userData.userName}, I have detected **${userData.risks.length} active financial risks** in your profile:
        
${userData.risks.map((r, idx) => `${idx + 1}. **[${r.severity}] ${r.title}**: ${r.description} *(Impact: ${r.impact})*`).join("\n\n")}

**AI Advisory Priority**:
Resolve any **CRITICAL** severity risks first. For example, if you have breached budgets, you must adjust spending in those specific categories for the remaining days of this month to compensate.`;
      }
    } 
    else {
      response = `Welcome ${userData.userName} to SpendWise AI Advisor! I've analyzed your financial logs:
      
- **Financial Health Score**: **${userData.healthScore}/100**
- **Savings Rate**: **${userData.savingsRate.toFixed(1)}%**
- **Risks**: We detected **${userData.risks.length} active risk items**.
- **Top Concentration**: **${userData.topCategory.name}** consumes **${userData.topCategory.percentage.toFixed(0)}%** of your total outflows.

Here are your recent transaction entries that I am monitoring:
${userData.recentTxFormatted.split('\n').slice(0, 3).join('\n')}

How can I help you optimize your money today? You can select one of the suggested topics below or type a specific question about your transactions, budgets, or savings.

*(Note: To unlock full open-ended conversational chat capabilities, you can configure your \`GEMINI_API_KEY\` in the backend environment variables.)*`;
    }

    return {
      response,
      confidence: 0.8,
      recommendations,
      followUpSuggestions,
    };
  }
}

module.exports = new AiAdvisorService();
