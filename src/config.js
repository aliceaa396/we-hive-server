module.exports = {
  PORT: process.env.PORT || 8080,
  NODE_ENV: process.env.NODE_ENV || "development",
  DB_URL: process.env.DB_URL || "postgresql://hive_admin@localhost/we_hive",
  JWT_SECRET: process.env.JWT_SECRET || "change-this-secret"
};
