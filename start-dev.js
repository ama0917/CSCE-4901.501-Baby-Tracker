const { spawn } = require('child_process');

// Start Flask backend
const flaskProcess = spawn('python', ['backend/flask_app.py'], {
  stdio: 'inherit',
  shell: true
});

// Start Expo frontend
const expoProcess = spawn('npx', ['expo', 'start'], {
  stdio: 'inherit',
  shell: true
});

// If Flask crashes, kill Expo too
flaskProcess.on('exit', (code) => {
  console.log(`[start-dev] Flask exited with code ${code}`);
  expoProcess.kill();
});

// Graceful shutdown with Ctrl+C
process.on('SIGINT', () => {
  flaskProcess.kill();
  expoProcess.kill();
  process.exit();
});
