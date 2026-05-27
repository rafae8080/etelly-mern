import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token)
    return res.status(401).json({ message: "No token, unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Admin access required" });
  next();
};

export const requireAdminOrBarangay = (req, res, next) => {
  if (!["admin", "barangay_official"].includes(req.user.role))
    return res.status(403).json({ message: "Insufficient permissions" });
  next();
};

// Soft auth — sets req.user if a valid Bearer token is present, otherwise req.user = null.
// Use on endpoints that accept both anonymous (web form) and authenticated (mobile) callers.
export const optionalProtect = (req, res, next) => {
  if (req.headers.authorization?.startsWith("Bearer ")) {
    return protect(req, res, next);
  }
  req.user = null;
  next();
};
