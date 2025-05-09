const errorHandler = (err, req, res, next) => {
    console.error(err.stack); // Log the error stack for debugging

    const statusCode = err.status || 500;
    const isProduction = process.env.NODE_ENV === "production";

    // Handle specific Mongoose errors
    if (err.name === "ValidationError") {
        return res.status(400).json({ success: false, message: err.message });
    }

    if (err.name === "CastError") {
        return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    // Handle MongoDB errors
    if (err.name === "MongoError") {
        return res.status(500).json({ success: false, message: "Database error occurred" });
    }

    // Unauthorized or Forbidden access
    if (err.status === 401) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (err.status === 403) {
        return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Handle Not Found errors
    if (err.status === 404) {
        return res.status(404).json({ success: false, message: "Resource not found" });
    }

    // Default server error
    res.status(statusCode).json({
        success: false,
        message: isProduction ? "Internal Server Error" : err.message,
        ...(isProduction ? {} : { stack: err.stack }), // Include stack trace only in development
    });
};

module.exports = errorHandler;