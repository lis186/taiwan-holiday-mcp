// Lightweight env for Stryker. The default Jest setup rebuilds dist and
// stubs console.log; neither belongs in a mutation run.
process.env.TZ = 'Asia/Taipei';
if (!process.env.DEBUG) {
  process.env.DEBUG = 'false';
}
