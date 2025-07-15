// utils/logger.js
const { createLogger, transports, format } = require('winston')
const path = require('path')

const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf((info) => `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`)
)

const logger = createLogger({
  level: 'info', // default level
  format: logFormat,
  transports: [
    new transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
    }),
    new transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
    }),
  ],
})

// ✅ Add timestamp and formatting to the console
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),                      // Add color for levels
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
      )
    })
  )
}

module.exports = logger
