const express = require('express');
const cors = require('cors');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'Bewerbungs-Backend laeuft!' });
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
    imap.openBox('INBOX', false, (err, box) => {
      if (err) return res.status(500).json({ error: err.message });

      imap.search(['ALL'], (err, results) => {
        if (err || !results.length) {
          imap.end();
          return res.json({ emails: [] });
        }

        const recent = results.slice(-20).reverse();
        const fetch = imap.fetch(recent, { bodies: '' });

        fetch.on('message', (msg) => {
          msg.on('body', (stream) => {
            simpleParser(stream, (err, parsed) => {
              if (!err) {
                const from = parsed.from ? parsed.from.text : '';
                const subject = parsed.subject || '';
                const text = parsed.text || '';

                let type = 'other';
                const lower = (from + subject + text).toLowerCase();
                if (lower.includes('ams') || lower.includes('arbeitsmarkt')) {
                  type = 'ams';
                } else if (lower.includes('stelle') || lower.includes('job') || lower.includes('bewerbung') || lower.includes('karriere')) {
                  type = 'job';
                }

                let company = '';
                const companyMatch = subject.match(/bei\s+([^,\-]+)/i);
                if (companyMatch) company = companyMatch[1].trim();

                let job = '';
                const jobMatch = subject.match(/als\s+([^,\-bei]+)/i);
                if (jobMatch) job = jobMatch[1].trim();

                emails.push({
                  id: Date.now() + Math.random(),
                  from: from,
                  subject: subject,
                  date: parsed.date ? parsed.date.toLocaleDateString('de-AT') : '',
                  body: text.substring(0, 1000),
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
    res.status(500).json({ error: 'IMAP Fehler: ' + err.message });
  });

  imap.connect();
});

app.post('/send', (req, res) => {
  const { email, password, to, subject, text } = req.body;

  const transporter = nodemailer.createTransport({
    host: 'mail.gmx.net',
    port: 587,
    secure: false,
    auth: { user: email, pass: password },
    tls: { rejectUnauthorized: false }
  });

  transporter.sendMail({
    from: email,
    to: to,
    subject: subject,
    text: text
  }, (err, info) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, messageId: info.messageId });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server laeuft auf Port ' + PORT);
});
```

Einfügen → dann **"Commit changes"** klicken! 😊
