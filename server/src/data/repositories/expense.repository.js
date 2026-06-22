const mongoose = require("mongoose");
const { Expense } = require("../models");

const parseDateBoundary = (input, setEnd = false) => {
  if (!input) return null;
  let date;
  if (input instanceof Date) {
    date = new Date(input.getTime());
  } else if (typeof input === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      const [year, month, day] = input.split("-").map(Number);
      date = new Date(Date.UTC(year, month - 1, day));
    } else {
      date = new Date(input);
    }
  } else {
    date = new Date(input);
  }
  if (isNaN(date.getTime())) return null;
  if (setEnd) {
    date.setUTCHours(23, 59, 59, 999);
  } else {
    date.setUTCHours(0, 0, 0, 0);
  }
  return date;
};

class ExpenseRepository {
  create(data) {
    return Expense.create(data);
  }

  findById(id) {
    return Expense.findById(id).populate("category", "name colorCode icon").exec();
  }

  findByIdForUser(id, userId) {
    return Expense.findOne({ _id: id, user: userId }).populate("category", "name colorCode icon").exec();
  }

  updateById(id, data) {
    return Expense.findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .populate("category", "name colorCode icon")
      .exec();
  }

  deleteById(id) {
    return Expense.findByIdAndDelete(id).exec();
  }

  /**
   * Filtered, paginated listing used by GET /expenses.
   */
  async findPaginated(userId, { from, to, category, type, skip, limit }) {
    const filter = { user: userId };
    if (from || to) {
      filter.date = {};
      if (from) {
        const fromDate = parseDateBoundary(from, false);
        if (fromDate) filter.date.$gte = fromDate;
      }
      if (to) {
        const toDate = parseDateBoundary(to, true);
        if (toDate) filter.date.$lte = toDate;
      }
    }
    if (category) filter.category = category;
    if (type) filter.type = type;

    const [items, total] = await Promise.all([
      Expense.find(filter)
        .populate("category", "name colorCode icon")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Expense.countDocuments(filter),
    ]);

    return { items, total };
  }

  /**
   * Geospatial "expenses near me" query. Uses $geoNear, which must be the
   * first stage of the aggregation pipeline and requires the 2dsphere index
   * defined on Expense.location.
   */
  async findNearby(userId, { longitude, latitude, radiusMeters = 5000, limit = 50 }) {
    return Expense.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [longitude, latitude] },
          distanceField: "distanceMeters",
          maxDistance: radiusMeters,
          query: { user: new mongoose.Types.ObjectId(userId) },
          spherical: true,
        },
      },
      { $sort: { distanceMeters: 1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
    ]);
  }

  /**
   * Lightweight projection for plotting expenses on a map/heatmap on the
   * frontend. Only returns documents that actually have a location set.
   */
  findForMap(userId, { from, to } = {}) {
    const filter = { user: userId, location: { $ne: null } };
    if (from || to) {
      filter.date = {};
      if (from) {
        const fromDate = parseDateBoundary(from, false);
        if (fromDate) filter.date.$gte = fromDate;
      }
      if (to) {
        const toDate = parseDateBoundary(to, true);
        if (toDate) filter.date.$lte = toDate;
      }
    }
    return Expense.find(filter)
      .select("amount currency type date location category customCategory")
      .populate("category", "name colorCode")
      .lean()
      .exec();
  }

  /**
   * Sum of expenses for a given category within a date range — used by the
   * budget service to compute "amount spent so far this month".
   */
  async sumByCategoryAndRange(userId, categoryId, startDate, endDate) {
    const result = await Expense.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          category: new mongoose.Types.ObjectId(categoryId),
          type: "expense",
          date: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    return result.length ? result[0].total : 0;
  }

  async sumAllCategoriesByRange(userId, startDate, endDate) {
    const results = await Expense.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          type: "expense",
          date: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
    ]);
    const map = {};
    results.forEach((r) => {
      if (r._id) {
        map[r._id.toString()] = r.total;
      }
    });
    return map;
  }

  /**
   * Category-wise breakdown for analytics dashboard pie chart.
   */
  async categoryBreakdown(userId, startDate, endDate, type = "expense") {
    return Expense.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          type: type,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $project: {
          _id: 0,
          categoryId: "$category._id",
          name: "$category.name",
          colorCode: "$category.colorCode",
          total: 1,
          count: 1,
        },
      },
      { $sort: { total: -1 } },
    ]);
  }

  /**
   * Monthly trend (last N months) for line/bar chart on dashboard.
   */
  async monthlyTrend(userId, monthsBack = 6) {
    const start = new Date();
    start.setMonth(start.getMonth() - monthsBack + 1, 1);
    start.setHours(0, 0, 0, 0);

    return Expense.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          type: "expense",
          date: { $gte: start },
        },
      },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);
  }

  async getTrend(userId, { groupBy = "month", from, to, type = "expense", timezone = "UTC" }) {
    const start = parseDateBoundary(from, false) || new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1, 0, 0, 0, 0));
    const end = parseDateBoundary(to, true) || new Date();

    const matchStage = {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        type: type,
        date: { $gte: start, $lte: end }
      }
    };

    let groupStage = {};
    let sortStage = {};
    let projectStage = {};

    if (groupBy === "hour") {
      groupStage = {
        $group: {
          _id: {
            hour: { $hour: { date: "$date", timezone: timezone } },
            minute: { $minute: { date: "$date", timezone: timezone } },
            second: { $second: { date: "$date", timezone: timezone } }
          },
          total: { $sum: "$amount" },
          transactions: {
            $push: {
              amount: "$amount",
              note: "$note",
              type: "$type",
              date: "$date"
            }
          }
        }
      };
      projectStage = {
        $project: {
          _id: 0,
          hour: "$_id.hour",
          minute: "$_id.minute",
          second: "$_id.second",
          total: 1,
          transactions: 1
        }
      };
      sortStage = { $sort: { hour: 1, minute: 1, second: 1 } };
    } else if (groupBy === "day") {
      groupStage = {
        $group: {
          _id: {
            year: { $year: { date: "$date", timezone: timezone } },
            month: { $month: { date: "$date", timezone: timezone } },
            day: { $dayOfMonth: { date: "$date", timezone: timezone } }
          },
          total: { $sum: "$amount" },
          transactions: {
            $push: {
              amount: "$amount",
              note: "$note",
              type: "$type",
              date: "$date"
            }
          }
        }
      };
      projectStage = {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          day: "$_id.day",
          dateString: {
            $concat: [
              { $toString: "$_id.year" },
              "-",
              {
                $cond: [
                  { $lt: ["$_id.month", 10] },
                  { $concat: ["0", { $toString: "$_id.month" }] },
                  { $toString: "$_id.month" }
                ]
              },
              "-",
              {
                $cond: [
                  { $lt: ["$_id.day", 10] },
                  { $concat: ["0", { $toString: "$_id.day" }] },
                  { $toString: "$_id.day" }
                ]
              }
            ]
          },
          total: 1,
          transactions: 1
        }
      };
      sortStage = { $sort: { year: 1, month: 1, day: 1 } };
    } else if (groupBy === "year") {
      groupStage = {
        $group: {
          _id: { year: { $year: { date: "$date", timezone: timezone } } },
          total: { $sum: "$amount" }
        }
      };
      projectStage = {
        $project: {
          _id: 0,
          year: "$_id.year",
          total: 1
        }
      };
      sortStage = { $sort: { year: 1 } };
    } else {
      // month
      groupStage = {
        $group: {
          _id: {
            year: { $year: { date: "$date", timezone: timezone } },
            month: { $month: { date: "$date", timezone: timezone } }
          },
          total: { $sum: "$amount" }
        }
      };
      projectStage = {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          total: 1
        }
      };
      sortStage = { $sort: { year: 1, month: 1 } };
    }

    return Expense.aggregate([
      matchStage,
      groupStage,
      projectStage,
      sortStage
    ]);
  }

  async getSummary(userId, { from, to } = {}) {
    const filter = { user: new mongoose.Types.ObjectId(userId) };
    if (from || to) {
      filter.date = {};
      if (from) {
        const fromDate = parseDateBoundary(from, false);
        if (fromDate) filter.date.$gte = fromDate;
      }
      if (to) {
        const toDate = parseDateBoundary(to, true);
        if (toDate) filter.date.$lte = toDate;
      }
    }
    const result = await Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
        },
      },
    ]);

    let totalIncome = 0;
    let totalExpenses = 0;

    result.forEach((r) => {
      if (r._id === "income") totalIncome = r.total;
      if (r._id === "expense") totalExpenses = r.total;
    });

    return {
      totalIncome,
      totalExpenses,
      netSavings: totalIncome - totalExpenses,
    };
  }
}

module.exports = new ExpenseRepository();
