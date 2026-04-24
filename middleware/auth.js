function ensureAuthenticated(req, res, next) {
  if (!req.session.user) {
    req.session.flash = {
      type: "error",
      message: "Please log in to continue.",
    };
    res.redirect("/login");
    return;
  }

  next();
}

function ensureRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      req.session.flash = {
        type: "error",
        message: "Please log in to continue.",
      };
      res.redirect("/login");
      return;
    }

    if (!roles.includes(req.session.user.role)) {
      req.session.flash = {
        type: "error",
        message: "You do not have permission to access that page.",
      };
      res.redirect("/dashboard");
      return;
    }

    next();
  };
}

export { ensureAuthenticated, ensureRole };