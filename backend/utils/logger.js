const log = (level, message, meta = {}) => {
  const payload = {
    ts:      new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  // In production, output JSON for log aggregators (Datadog, Logtail, etc.)
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(payload));
  } else {
    const color = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' }[level] || '';
    const reset = '\x1b[0m';
    console.log(`${color}[${level.toUpperCase()}]${reset} ${message}`, Object.keys(meta).length ? meta : '');
  }
};

module.exports = {
  info:  (message, meta) => log('info',  message, meta),
  warn:  (message, meta) => log('warn',  message, meta),
  error: (message, meta) => log('error', message, meta),
};
