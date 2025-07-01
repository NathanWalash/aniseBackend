// Use CommonJS require because gocardless-nodejs does not provide ES module exports
const gocardless = require('gocardless-nodejs');
const constants = require('gocardless-nodejs/constants');

const client = gocardless(
  process.env.GOCARDLESS_ACCESS_TOKEN,
  process.env.GOCARDLESS_ENVIRONMENT === 'live' ? constants.Environments.Live : constants.Environments.Sandbox,
  { raiseOnIdempotencyConflict: true }
);

console.log('GoCardless ENV:', process.env.GOCARDLESS_ENVIRONMENT);
console.log('GoCardless Token:', process.env.GOCARDLESS_ACCESS_TOKEN ? 'set' : 'not set');
console.log('GoCardless client:', client);

export default client; 