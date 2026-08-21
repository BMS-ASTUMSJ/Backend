const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // User must be authenticated first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Normalize role
    const userRole = String(req.user.role || "").toLowerCase();

    // Normalize allowed roles
    const roles = allowedRoles.map((role) => String(role).toLowerCase());

    // Check role
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to perform this action.",
      });
    }

    next();
  };
};

module.exports = authorize;
