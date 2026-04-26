export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { meetings, tasks, preferences, submittedAt } = req.body;

  // Your backend logic goes here — store to DB, send email, pipe to another service, etc.
  console.log('Submission received:', req.body);

  res.status(200).json({ success: true, received: { meetings, tasks, preferences, submittedAt } });
}
