const express = require('express');
const cors = require('cors');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(express.json({ limit: '25mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'OK' });
});

app.post('/emails', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email und Passwort fehlen' });
  }
  const imap = new Imap({
    user: email,
    password: password,
    host: 'imap.gmx.net',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  });
  const emails = [];
  imap.once('ready', () => {
    imap.openBox('INBOX', false, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      imap.search(['ALL'], (err, results) => {
        if (err || !results.length) {
          imap.end();
          return res.json({ emails: [] });
        }
        const recent = results.slice(-30).reverse();
        const fetch = imap.fetch(recent, { bodies: '' });
        fetch.on('message', (msg) => {
          msg.on('body', (stream) => {
            simpleParser(stream, (err, parsed) => {
              if (!err) {
                const from = parsed.from ? parsed.from.text : '';
                const fromEmail = parsed.from && parsed.from.value && parsed.from.value[0] ? parsed.from.value[0].address : '';
                const subject = parsed.subject || '';
                const text = parsed.text || '';
                const date = parsed.date ? parsed.date.toLocaleDateString('de-AT') : '';
                let type = 'other';
                const lower = (from + subject + text).toLowerCase();
                if (lower.includes('ams') || lower.includes('arbeitsmarkt')) {
                  type = 'ams';
                } else if (lower.includes('stelle') || lower.includes('job') || lower.includes('bewerbung') || lower.includes('karriere') || lower.includes('position')) {
                  type = 'job';
                }
                let company = '';
                const cm = subject.match(/bei\s+([^,\-]+)/i);
                if (cm) company = cm[1].trim();
                let job = '';
                const jm = subject.match(/als\s+([^,\-bei]+)/i);
                if (jm) job = jm[1].trim();
                emails.push({
                  id: Date.now() + Math.random(),
                  from: from,
                  email: fromEmail,
                  subject: subject,
                  date: date,
                  body: text.substring(0, 1500),
                  type: type,
                  company: company,
                  job: job
                });
              }
            });
          });
        });
        fetch.once('end', () => {
          setTimeout(() => {
            imap.end();
            res.json({ emails: emails });
          }, 2000);
        });
      });
    });
  });
  imap.once('error', (err) => {
    res.status(500).json({ error: err.message });
  });
  imap.connect();
});

app.post('/send', (req, res) => {
  const { email, password, to, subject, text, attachments, gmailUser, gmailPass } = req.body;

  if (!to) {
    return res.status(400).json({ error: 'Fehlende Daten' });
  }
  
  const senderUser = gmailUser || email;
  const senderPass = gmailPass || password;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { 
      user: gmailUser,
      pass: gmailPass
    }
  });

  const mailOptions = {
    from: senderUser,
    to: to,
    subject: subject,
    text: text
  };

  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments.map(a => ({
      filename: a.filename,
      content: a.content,
      encoding: 'base64'
    }));
  }

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, messageId: info.messageId });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server laeuft auf Port ' + PORT);
});
