const authService = require("../../business/services/auth.service");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const { jwt: jwtConfig, isProd } = require("../../config/env");

// Refresh tokens are sent as an httpOnly cookie so client-side JS can never
// read them (mitigates XSS token theft); the access token is returned in
// the JSON body for the SPA to hold in memory and attach as a Bearer header.
function setRefreshCookie(res, refreshToken) {
  const cookieOpts = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
  // Browsers silently drop cookies with an explicit "localhost" domain in
  // cross-port setups (e.g. :5173 ↔ :5000). Omitting domain lets the
  // browser default it correctly.
  if (jwtConfig.cookieDomain && jwtConfig.cookieDomain !== "localhost") {
    cookieOpts.domain = jwtConfig.cookieDomain;
  }
  res.cookie("refreshToken", refreshToken, cookieOpts);
}

const register = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.register(req.body);
  setRefreshCookie(res, refreshToken);
  new ApiResponse(201, { user, accessToken, refreshToken }, "Account created successfully").send(res);
});

const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  setRefreshCookie(res, refreshToken);
  new ApiResponse(200, { user, accessToken, refreshToken }, "Logged in successfully").send(res);
});

const refresh = asyncHandler(async (req, res) => {
  const incoming = req.cookies?.refreshToken || req.body.refreshToken;
  const { user, accessToken, refreshToken } = await authService.refresh(incoming);
  setRefreshCookie(res, refreshToken);
  new ApiResponse(200, { user, accessToken, refreshToken }, "Token refreshed").send(res);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);
  const clearOpts = {};
  if (jwtConfig.cookieDomain && jwtConfig.cookieDomain !== "localhost") {
    clearOpts.domain = jwtConfig.cookieDomain;
  }
  res.clearCookie("refreshToken", clearOpts);
  new ApiResponse(200, null, "Logged out successfully").send(res);
});

const me = asyncHandler(async (req, res) => {
  new ApiResponse(200, req.user.toSafeJSON()).send(res);
});

const forgotPassword = asyncHandler(async (req, res) => {
  const pin = await authService.forgotPassword(req.body.email);
  new ApiResponse(200, { pin }, "Reset PIN generated").send(res);
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  new ApiResponse(200, null, "Password reset successfully").send(res);
});

module.exports = { register, login, refresh, logout, me, forgotPassword, resetPassword };
