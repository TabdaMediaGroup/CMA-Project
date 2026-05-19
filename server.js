// ================================================================
// server.js — Creative Money Africa Quiz Backend
// ================================================================

const express    = require('express');
const path       = require('path');
const https      = require('https');
const crypto     = require('crypto');
const admin      = require('firebase-admin');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// ================================================================
// 🔑  ALL CREDENTIALS — from .env / Render environment variables
// ================================================================
const EO_API_KEY      = process.env.EO_API_KEY;
const EO_LIST_GENERAL = process.env.EO_LIST_GENERAL;
const EO_LIST_WEBINAR = process.env.EO_LIST_WEBINAR; // ← update this each session
const EO_BAND_LISTS   = {
  f: process.env.EO_LIST_F,
  g: process.env.EO_LIST_G,
  m: process.env.EO_LIST_M,
  l: process.env.EO_LIST_L,
};
const BREVO_API_KEY  = process.env.BREVO_API_KEY;
const BREVO_TEMPLATE = 2;


// ================================================================
// 🔥  FIREBASE
// ================================================================
admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   process.env.FB_PROJECT_ID,
    clientEmail: process.env.FB_CLIENT_EMAIL,
    privateKey:  process.env.FB_PRIVATE_KEY?.replace(/\\n/g, '\n')
  })
});
const db = admin.firestore();


// ================================================================
// 📝  QUIZ QUESTIONS
// ================================================================
const QUESTIONS = [
  {
    pillar: "Intellectual Property",
    key:    "ip",
    text:   "Have you registered the name, logo, or creative work of your business in any form?",
    options: [
      { label: "Yes — formally registered or in process",  points: 12 },
      { label: "No, but I know I should",                  points: 6  },
      { label: "No — I haven't thought about it",          points: 0  }
    ]
  },
  {
    pillar: "Personal Branding",
    key:    "brand",
    text:   "When someone searches your name online, what do they find?",
    options: [
      { label: "Very little — or something I'm not happy with",           points: 0  },
      { label: "A strong, consistent presence across multiple platforms",  points: 12 },
      { label: "Some content but nothing cohesive or recent",              points: 6  }
    ]
  },
  {
    pillar: "Pricing & Revenue",
    key:    "pricing",
    text:   "Do you have a written rate card or pricing structure you use consistently?",
    options: [
      { label: "Loosely — I have figures in my head",  points: 7  },
      { label: "No — I price per client or guess",     points: 0  },
      { label: "Yes — documented and I follow it",     points: 14 }
    ]
  },
  {
    pillar: "Digital Leverage",
    key:    "digital",
    text:   "Are you currently using digital platforms to generate income — not just followers?",
    options: [
      { label: "I use social media but not for direct income",     points: 0  },
      { label: "Yes — digital income is a real revenue stream",    points: 14 },
      { label: "I have an audience but haven't monetised it yet",  points: 7  }
    ]
  },
  {
    pillar: "Market Access",
    key:    "market",
    text:   "Have you sold your work or services to anyone outside your immediate city or country?",
    options: [
      { label: "I've had enquiries but nothing confirmed outside my area",  points: 6  },
      { label: "No — all my clients are local",                             points: 0  },
      { label: "Yes — I have clients or buyers in other regions",           points: 12 }
    ]
  },
  {
    pillar: "Distribution Systems",
    key:    "dist",
    text:   "Do you have a way of reaching your audience that you own completely — like an email list?",
    options: [
      { label: "No — I rely entirely on social media platforms",     points: 0  },
      { label: "Yes — email list or owned community I actively use", points: 12 },
      { label: "I have some contacts but nothing systematic",        points: 6  }
    ]
  },
  {
    pillar: "Business Structure",
    key:    "structure",
    text:   "Do you have a formal business registration, a separate business account, or a legal business entity?",
    options: [
      { label: "Yes — registered business with separate finances",  points: 12 },
      { label: "No — everything runs through personal accounts",    points: 0  },
      { label: "Partially — one or the other, not both",            points: 6  }
    ]
  },
  {
    pillar: "Growth Mindset",
    key:    "growth",
    text:   "In the last 90 days, have you invested in your own business education — a course, book, or mentor?",
    options: [
      { label: "No — I've been focused elsewhere",                               points: 0  },
      { label: "I consume free content regularly but haven't paid for learning",  points: 6  },
      { label: "Yes — actively investing in my development",                     points: 12 }
    ]
  }
];

const PMAX      = {};
QUESTIONS.forEach(q => { PMAX[q.key] = Math.max(...q.options.map(o => o.points)); });
const TOTAL_MAX = QUESTIONS.reduce((sum, q) => sum + PMAX[q.key], 0);


// ================================================================
// 🏆  BAND DEFINITIONS
// ================================================================
const BANDS = {
  f: {
    key:   'f',
    band:  "The Creative Foundation Builder",
    title: 'Real potential — <span class="gold">a clear starting point.</span>',
    intro: "Your score shows the early structural phase of your creative business. The gaps are clear, the actions specific, and every one is fixable.",
    gap:   "Your most urgent gap is structural: IP protection and pricing confidence. Most creatives at your stage are leaving significant income uncaptured simply because they haven't formalised what they already have.",
    cta:   "Your 30-Day Foundation Plan begins today — starting with IP protection and pricing basics. One action, every day, under 20 minutes.",
    rcc:   "Your Foundation Plan Starts Now."
  },
  g: {
    key:   'g',
    band:  "The Creative Growth Accelerator",
    title: 'Foundations laid — <span class="gold">time to accelerate.</span>',
    intro: "You have the foundations in place and you're generating income. The opportunity now is distribution and digital leverage — moving from direct effort to compounding systems.",
    gap:   "The gap most limiting your revenue right now is digital leverage. You have an audience — but you may not have a system for turning that audience into consistent, scalable income.",
    cta:   "Your 30-Day Growth Plan begins today — starting with distribution systems and digital leverage.",
    rcc:   "Your Growth Plan Starts Now."
  },
  m: {
    key:   'm',
    band:  "The Creative Momentum Builder",
    title: 'Strong foundations — <span class="gold">scale the reach.</span>',
    intro: "Your score places you ahead of most African creatives in structural readiness. The ceiling from here is not effort — it's market access and monetisation sophistication.",
    gap:   "Your top opportunity is market access. You've built the systems — the next move is reaching clients, collaborators, and buyers in markets beyond where you currently operate.",
    cta:   "Your 30-Day Momentum Plan begins today — starting with market access and advanced monetisation.",
    rcc:   "Your Momentum Plan Starts Now."
  },
  l: {
    key:   'l',
    band:  "The Creative Economy Leader",
    title: "You're already ahead — <span class=\"gold\">now lead.</span>",
    intro: "You operate at a level most African creatives aspire to. The opportunity ahead is not fixing gaps — it's deepening authority and helping others find the path you've already walked.",
    gap:   "Your most valuable next move is deepening your strategic positioning and extending your influence into the communities and institutions shaping Africa's creative economy.",
    cta:   "You've unlocked the African Creative Economy Growth Playbook — and an invitation to join our inner community of leaders.",
    rcc:   "You've Unlocked the Playbook."
  }
};

function getBand(score) {
  if (score <= 40) return BANDS.f;
  if (score <= 65) return BANDS.g;
  if (score <= 85) return BANDS.m;
  return BANDS.l;
}


// ================================================================
// 📡  GET /api/questions
// ================================================================
app.get('/api/questions', (req, res) => {
  const safe = QUESTIONS.map(q => ({
    pillar:  q.pillar,
    key:     q.key,
    text:    q.text,
    options: q.options.map(o => ({ label: o.label }))
  }));
  res.json(safe);
});


// ================================================================
// 📡  POST /api/submit
// ================================================================
app.post('/api/submit', async (req, res) => {
  const { name, email, answers } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Invalid email' });
  }

  let total = 0;
  const pillars = {};
  QUESTIONS.forEach(q => {
    const idx    = answers?.[q.key];
    const points = (idx !== undefined && q.options[idx]) ? q.options[idx].points : 0;
    total += points;
    pillars[q.key] = {
      label:  q.pillar,
      points,
      max:    PMAX[q.key],
      pct:    Math.round((points / PMAX[q.key]) * 100)
    };
  });

  const band = getBand(total);

  // Return result to user immediately
  res.json({
    success:  true,
    score:    total,
    totalMax: TOTAL_MAX,
    band: {
      key:   band.key,
      name:  band.band,
      title: band.title,
      intro: band.intro,
      gap:   band.gap,
      cta:   band.cta,
      rcc:   band.rcc
    },
    pillars
  });

  // Fire all three in parallel after response
  console.log('[SUBMIT] New submission —', email, '| Score:', total, '| Band:', band.key);
  console.log('[SUBMIT] BREVO_API_KEY loaded:', BREVO_API_KEY ? 'YES' : 'NO — CHECK ENV VARS');

  try {
    const [eoRes, fbRes, brevoRes] = await Promise.allSettled([
      addToEmailOctopus({ name: name || '', email, bandKey: band.key }),
      saveToFirebase({ name: name || '', email, score: total, band, pillars }),
      sendWelcomeEmail({ name: name || '', email, score: total, bandName: band.band })
    ]);
    console.log('[EmailOctopus]', eoRes.status,    eoRes.status === 'rejected' ? eoRes.reason?.message : 'OK');
    console.log('[Firebase]',     fbRes.status,    fbRes.status === 'rejected' ? fbRes.reason?.message : 'OK');
    console.log('[Brevo]',        brevoRes.status, brevoRes.status === 'rejected' ? brevoRes.reason?.message : 'OK');
  } catch(e) {
    console.error('[SUBMIT ERROR]', e.message);
  }
});


// ================================================================
// 📬  EmailOctopus
// ================================================================
function addToEmailOctopus({ name, email, bandKey }) {
  function postToList(listId) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        api_key:       EO_API_KEY,
        email_address: email,
        fields:        { FirstName: name },
        status:        'SUBSCRIBED'
      });
      const options = {
        hostname: 'emailoctopus.com',
        path:     `/api/1.6/lists/${listId}/contacts`,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      };
      const req = https.request(options, response => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error && parsed.error.code !== 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS') {
              reject(new Error(parsed.error.message));
            } else { resolve(parsed); }
          } catch(e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.write(body); req.end();
    });
  }
  return Promise.all([
    postToList(EO_BAND_LISTS[bandKey]),
    postToList(EO_LIST_GENERAL)
  ]);
}


// ================================================================
// 🔥  Firebase
// ================================================================
async function saveToFirebase({ name, email, score, band, pillars }) {
  await db.collection('cma_submissions').add({
    name,
    email,
    score,
    bandKey:     band.key,
    bandName:    band.band,
    pillars,
    submittedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}


// ================================================================
// ✉️  Brevo API — send welcome email via Template #2
// ================================================================
function sendWelcomeEmail({ name, email, score, bandName }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      templateId: BREVO_TEMPLATE,
      to:         [{ email, name }],
      sender:     { name: process.env.BREVO_SENDER_NAME || 'Creative Money Africa', email: process.env.BREVO_SENDER_EMAIL },
      params: {
        name,
        score,
        band_name: bandName
      }
    });

    const options = {
      hostname: 'api.brevo.com',
      path:     '/v3/smtp/email',
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'api-key':        BREVO_API_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, response => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('[Brevo RAW] status:', response.statusCode, '| body:', data);
          if (response.statusCode === 201) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || `Brevo failed: ${response.statusCode} — ${data}`));
          }
        } catch(e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(body); req.end();
  });
}


// ================================================================
// 📡  POST /api/register-webinar
// ================================================================
app.post('/api/register-webinar', async (req, res) => {
  const { name, email, phone } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, reason: 'invalid_email' });
  }

  try {
    // 1 — Check if already registered for THIS webinar session
    const alreadyRegistered = await checkEmailOctopus(EO_LIST_WEBINAR, email);
    if (alreadyRegistered) {
      return res.json({ success: false, reason: 'already_registered' });
    }

    // 2 — Internally check if email is on the general list (determines which email they get)
    const isOnGeneralList = await checkEmailOctopus(EO_LIST_GENERAL, email);

    // 3 — Register to webinar list + Firebase regardless of general list status
    const [eoRes, fbRes] = await Promise.allSettled([
      addToWebinarList({ name: name || '', email, phone: phone || '' }),
      saveWebinarRegistration({ name: name || '', email, phone: phone || '', isExistingMember: isOnGeneralList })
    ]);

    console.log('[WEBINAR] Registered:', email, '| Existing member:', isOnGeneralList);
    console.log('[WEBINAR] EmailOctopus:', eoRes.status, eoRes.reason?.message || 'OK');
    console.log('[WEBINAR] Firebase:',    fbRes.status,  fbRes.reason?.message  || 'OK');

    // 4 — Send appropriate email based on list membership
    const templateId = isOnGeneralList ? 3 : 4;
    const emailRes = await sendWebinarEmail({ name: name || 'Friend', email, templateId });
    console.log('[WEBINAR] Brevo template', templateId, '→', emailRes ? 'sent' : 'failed');

    return res.json({ success: true });

  } catch (e) {
    console.error('[WEBINAR ERROR]', e.message);
    return res.status(500).json({ success: false, reason: 'server_error' });
  }
});


// ================================================================
// 🔍  Check if email exists in an EmailOctopus list
// ================================================================
function checkEmailOctopus(listId, email) {
  return new Promise((resolve) => {
    // EmailOctopus identifies contacts by MD5 hash of lowercase email
    const memberId = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
    const options = {
      hostname: 'emailoctopus.com',
      path:     `/api/1.6/lists/${listId}/contacts/${memberId}?api_key=${EO_API_KEY}`,
      method:   'GET'
    };
    const req = https.request(options, response => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        // 200 = found, 404 = not on list, anything else = treat as not found
        resolve(response.statusCode === 200);
      });
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}


// ================================================================
// 📬  Add to the current session's webinar list
// ================================================================
function addToWebinarList({ name, email, phone }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      api_key:       EO_API_KEY,
      email_address: email,
      fields:        { FirstName: name, Phone: phone },
      status:        'SUBSCRIBED'
    });
    const options = {
      hostname: 'emailoctopus.com',
      path:     `/api/1.6/lists/${EO_LIST_WEBINAR}/contacts`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, response => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // MEMBER_EXISTS is fine — they're already registered
          if (parsed.error && parsed.error.code !== 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS') {
            reject(new Error(parsed.error.message));
          } else {
            resolve(parsed);
          }
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}


// ================================================================
// ✉️  Brevo — send webinar confirmation email (template 3 or 4)
// ================================================================
function sendWebinarEmail({ name, email, templateId }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      templateId,
      to:     [{ email, name }],
      sender: { name: process.env.BREVO_SENDER_NAME || 'Creative Money Africa', email: process.env.BREVO_SENDER_EMAIL },
      params: { name }
    });
    const options = {
      hostname: 'api.brevo.com',
      path:     '/v3/smtp/email',
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY, 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, response => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        console.log('[Brevo WEBINAR] status:', response.statusCode, '| body:', data);
        response.statusCode === 201 ? resolve(true) : reject(new Error(`Brevo failed: ${response.statusCode} — ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}


// ================================================================
// 🔥  Save webinar registration to Firebase
// ================================================================
async function saveWebinarRegistration({ name, email, phone, isExistingMember }) {
  await db.collection('cma_webinar_registrations').add({
    name,
    email,
    phone,
    isExistingMember: isExistingMember || false,
    webinarListId: EO_LIST_WEBINAR,
    registeredAt:  admin.firestore.FieldValue.serverTimestamp()
  });
}


// ================================================================
// Fallback
// ================================================================
app.get('/webinar', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'webinar.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CMA Quiz running on port ${PORT}`);
});
