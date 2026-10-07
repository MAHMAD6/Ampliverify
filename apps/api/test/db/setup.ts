// The in-process job worker stays off in tests; specs drain queues explicitly.
process.env.JOBS_WORKER = 'off';
jest.setTimeout(120000);
