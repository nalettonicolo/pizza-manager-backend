// src/utils/logger.js

export function log(section, message, data = null) {
  console.log(
    `%c[${section}]`,
    "color: #ff6600; font-weight: bold;",
    message,
    data || ""
  )
}

export function logError(section, message, error = null) {
  console.error(
    `%c[${section} ERROR]`,
    "color: red; font-weight: bold;",
    message,
    error || ""
  )
}
