/**
 * The answer library — WHATSAPP-BOT-KNOWLEDGE.md section 6.
 *
 * Every reply here is copied from the knowledge base. Nothing is invented.
 * Anything not matched falls through to trigger 13 (hand over), which is the
 * behaviour the knowledge base asks for: "Anything the knowledge base does not
 * cover" -> escalate.
 *
 * `{{site}}` is replaced with FSP_WEBSITE_URL at send time.
 */

import type { Reply } from './templates';

export type LeadField =
  | 'name'
  | 'city'
  | 'profession'
  | 'profile'
  | 'goal'
  | 'program'
  | 'contact_time';

export type Intent = {
  id: string;
  /** Shown in the dashboard analytics. */
  label: string;
  group: 'about' | 'fit' | 'programs' | 'objection' | 'smalltalk';
  /** Each matching pattern adds to the score. */
  patterns: RegExp[];
  /** Multiplier for intents that should win ties. */
  weight?: number;
  reply: Reply;
  /** The field the reply's closing question collects, if any. */
  captures?: LeadField;
};

export const INTENTS: Intent[] = [
  /* ── 6.1 About FSP ─────────────────────────────────────── */
  {
    id: 'what-is-fsp',
    label: 'What is FSP',
    group: 'about',
    weight: 1.4,
    patterns: [
      // "what is FSP TTX" belongs to the TTX answer, not this one.
      /\bwhat(?:'?s| is) fsp\b(?!\s+(?:ttx|gtx|core|mastermind|master ?class|catalyst|community|habit|fun))/i,
      /\babout fsp\b(?!\s+(?:ttx|gtx|core|mastermind|master ?class|catalyst))/i,
      /\bfsp na enna\b|\bfsp enna\b/i,
      /\btell me (?:more )?about (?:this|the|your) (?:program|programme|course|fsp)\b/i,
      /\bwhat (?:is )?this (?:program|programme|about)\b/i,
      /\bfull form\b|\bwhat does fsp stand for\b/i,
      /\bexplain fsp\b|\bdetails about fsp\b|\bfsp details\b/i,
      /\bmore info\b|\bmore information\b|\bsend details\b|\bshare details\b/i,
    ],
    captures: 'profession',
    reply: {
      en: 'FSP — the *Facilitator Support Program* — is a practical learning and growth ecosystem for trainers, facilitators and aspiring facilitators.\n\nIt helps you with three things together:\n• Improve your facilitation skills\n• Build your personal brand\n• Create more professional opportunities\n\nOur philosophy is simple — *Learn. Lead. Impact.*\n\nMay I know what you do currently? I’ll tell you which part of FSP fits you best.',
      ta: 'FSP என்பது *Facilitator Support Program* — பயிற்சியாளர்கள், facilitators மற்றும் facilitator ஆக விரும்புபவர்களுக்கான ஒரு நடைமுறை கற்றல் மற்றும் வளர்ச்சி சூழல்.\n\nமூன்று விஷயங்களில் உதவுகிறது:\n• உங்கள் facilitation திறனை மேம்படுத்த\n• உங்கள் personal brand உருவாக்க\n• அதிக தொழில் வாய்ப்புகளை உருவாக்க\n\nஎங்கள் தத்துவம் எளிமையானது — *Learn. Lead. Impact.*\n\nநீங்கள் தற்போது என்ன செய்கிறீர்கள்? FSP-ல் உங்களுக்கு எது சரியாகப் பொருந்தும் என்று சொல்கிறேன்.',
      tl: 'FSP na — *Facilitator Support Program*. Trainers, facilitators, and facilitator aaga aasai padravangaluku oru practical learning ecosystem.\n\nMoonu mukkiyamana vishayam:\n• Facilitation skill improve pannalaam\n• Personal brand build pannalaam\n• Professional opportunities create pannalaam\n\nNamma philosophy simple — *Learn. Lead. Impact.*\n\nNeenga ippo enna pandringa? Ungaluku edhu correct fit-nu solren.',
    },
  },
  {
    id: 'just-a-course',
    label: 'Is FSP just another course',
    group: 'about',
    patterns: [
      /\bjust (?:another|a) (?:course|program|workshop|training)\b/i,
      /\bhow is (?:it|this|fsp) different\b|\bwhat makes (?:it|fsp) different\b/i,
      /\bonly a course\b|\bis (?:it|this) a course\b/i,
    ],
    reply: {
      en: "It's more than a course. A course ends — FSP is an ecosystem you stay inside.\n\nYou *Learn* the foundations, *Practice* through activities and assignments, *Create* your own modules and workbooks, *Build* your brand, *Connect* with a community of facilitators, and keep *Growing*.",
      tl: "Idhu oru course-ku mela. Course mudinjiduchu-nu aagidum — FSP na neenga ulla irukkura oru ecosystem.\n\n*Learn* foundations, *Practice* activities and assignments moolama, *Create* unga sontha modules and workbooks, *Build* unga brand, *Connect* facilitator community kooda, and continuous-a *Grow*.",
    },
  },
  {
    id: 'why-need-fsp',
    label: 'Why do I need FSP',
    group: 'about',
    patterns: [
      /\bwhy (?:do i|should i|would i) need\b|\bwhy fsp\b|\bwhy join\b/i,
      /\b(?:i'?m|i am)\s+already (?:a )?(?:good|experienced|senior)\b/i,
      /\balready (?:a )?good trainer\b|\balready training\b.*\bwhy\b/i,
      /\bwhat'?s the (?:benefit|use|point)\b|\bbenefits of fsp\b/i,
    ],
    reply: {
      en: 'Being a good trainer is often not enough on its own. Great facilitation also means engaging different types of participants, designing meaningful learning experiences, debriefing effectively, handling difficult participants, creating your own modules, building your brand, marketing yourself, writing proposals and generating opportunities.\n\nFSP helps you develop all of these together.',
      tl: 'Nalla trainer-a irukradhu mattum podhadhu. Great facilitation na — different types of participants-a engage panradhu, meaningful learning experiences design panradhu, effective-a debrief panradhu, difficult participants-a handle panradhu, sontha modules create panradhu, brand build panradhu, self marketing, proposals ezhudhuradhu, opportunities create panradhu.\n\nIdhu ellathayum sernthu develop panna FSP help pannum.',
    },
  },
  {
    id: 'founder',
    label: 'Who is the founder',
    group: 'about',
    weight: 1.2,
    patterns: [
      /\bwho (?:runs|owns|started|founded|is behind)\b/i,
      /\b(?:the )?founder\b(?!.*\b(?:number|contact|talk|speak|meet|call)\b)/i,
      /\bwho is the (?:trainer|mentor|coach|teacher|faculty)\b/i,
      /\babout the founder\b|\bfounder details\b|\byaaru nadathuraanga\b/i,
    ],
    reply: {
      en: 'FSP was founded by *Karunai Prakash* — Team Building Strategist, Facilitator and Founder of Key Purpose Training Solutions.\n\n• Certified Professional Trainer in Design & Facilitation of Experiential Learning — IIPE, Canada\n• NLP Master Practitioner · Certified OBT Trainer\n• 10+ years in training and facilitation\n• 500+ team-building / OBT programs · 1 Lakh+ people trained',
      tl: 'FSP-ya start panninadhu *Karunai Prakash* — Team Building Strategist, Facilitator, and Key Purpose Training Solutions-in Founder.\n\n• Certified Professional Trainer in Design & Facilitation of Experiential Learning — IIPE, Canada\n• NLP Master Practitioner · Certified OBT Trainer\n• 10+ years training and facilitation-la\n• 500+ team-building / OBT programs · 1 Lakh+ people trained',
    },
  },
  {
    id: 'vision',
    label: "FSP's vision",
    group: 'about',
    patterns: [/\bvision\b|\bmission\b|\bgoal of fsp\b|\bpurpose of fsp\b/i],
    reply: {
      en: 'To create *1000 impactful facilitators* — facilitators who don’t just conduct activities, but create meaningful learning experiences.',
      tl: '*1000 impactful facilitators* create panradhu — summa activities nadathuravanga illa, meaningful learning experiences create panravanga.',
    },
  },
  {
    id: 'community-size',
    label: 'Is FSP genuine / how big',
    group: 'about',
    patterns: [
      /\bhow (?:big|many members|large)\b|\bcommunity size\b|\bhow many people\b/i,
      /\bis (?:fsp|this|it) genuine\b|\bis (?:fsp|this|it) real\b|\btrustworthy\b|\blegit\b/i,
      /\bany proof\b|\btestimonial\b|\breviews?\b|\bfeedback from\b/i,
      /\bhow many members\b|\bhow many facilitators\b/i,
    ],
    reply: {
      en: 'FSP currently has a *1000+ member community*, 50+ learning resources and game videos, and the founder brings 10+ years of experience with 1 Lakh+ people trained across India and international locations.\n\nFSP’s training work spans organisations across industries — automotive, manufacturing, IT, banking and healthcare.',
      tl: 'FSP-la ippo *1000+ member community*, 50+ learning resources and game videos irukku. Founder-ku 10+ years experience, 1 Lakh+ people trained — India and international locations-la.\n\nFSP-yin training work palavagai industries-la paranthirukku — automotive, manufacturing, IT, banking, healthcare.',
    },
  },
  {
    id: 'website',
    label: 'Website / social links',
    group: 'about',
    patterns: [
      /\bwebsite\b|\bweb ?site\b|\bsite link\b|\byour page\b|\bwebpage\b/i,
      /\binstagram\b|\bfacebook\b|\blinkedin\b|\byoutube\b|\bsocial media\b/i,
      /\bwhere can i (?:see|read|check)\b/i,
    ],
    reply: {
      en: 'You can see the programs, the community and the founder’s background here:\n{{site}}\n\nHave a look, and ask me anything you want explained.',
      ta: 'programs, community மற்றும் founder-இன் background இங்கே பார்க்கலாம்:\n{{site}}\n\nபார்த்துவிட்டு, விளக்கம் வேண்டிய எதையும் கேளுங்கள்.',
      tl: 'Programs, community, and founder-in background inga paakalaam:\n{{site}}\n\nPaathutu, enna explain pananum-nu sollunga.',
    },
  },

  /* ── 6.2 Fit & Eligibility ─────────────────────────────── */
  {
    id: 'eligibility',
    label: 'Can I join / am I eligible',
    group: 'fit',
    patterns: [
      /\b(?:am i|can i be) eligible\b|\beligibility\b|\bwho can join\b/i,
      /\bcan i (?:still |also )?join\b|\bcan i (?:be a part|participate)\b/i,
      /\bis (?:it|this) for me\b|\bright for me\b|\bsuitable for me\b/i,
      /\bwho is (?:it|this) for\b|\btarget audience\b/i,
    ],
    captures: 'profile',
    reply: {
      en: 'Yes — FSP is open to aspiring trainers, new trainers, experienced trainers, corporate trainers, facilitators, and HR & L&D professionals.\n\nWhich of these sounds closest to you?',
      ta: 'ஆம் — aspiring trainers, புதிய trainers, அனுபவமுள்ள trainers, corporate trainers, facilitators, மற்றும் HR & L&D professionals அனைவருக்கும் FSP திறந்திருக்கிறது.\n\nஇதில் உங்களுக்கு எது மிக அருகில் இருக்கிறது?',
      tl: 'Aama — aspiring trainers, new trainers, experienced trainers, corporate trainers, facilitators, and HR & L&D professionals ellarukkum FSP open.\n\nIthula ungaluku edhu close-a irukku?',
    },
  },
  {
    id: 'zero-experience',
    label: 'No experience — can I join',
    group: 'fit',
    weight: 1.2,
    patterns: [
      /\b(?:no|zero|without any|don'?t have any|dont have) experience\b/i,
      /\b(?:i'?m|i am)\s+(?:a )?(?:beginner|fresher|new|starting)\b|\bjust starting\b|\bstart from (?:zero|scratch)\b/i,
      /\bnever (?:trained|facilitated|done)\b/i,
      /\bexperience illa\b|\bpudhusu\b/i,
    ],
    reply: {
      en: 'Absolutely. You don’t need any previous training experience — beginners start with the *Foundation of Facilitation* module and build from there.\n\nYou don’t need to know everything before you start. You need the right environment to learn, practise and grow.',
      ta: 'கண்டிப்பாக. முன்னர் training அனுபவம் தேவையில்லை — beginners *Foundation of Facilitation* module-ல் தொடங்கி அங்கிருந்து வளர்கிறார்கள்.\n\nதொடங்கும் முன் எல்லாம் தெரிந்திருக்க வேண்டியதில்லை. கற்க, பயிற்சி செய்ய, வளர சரியான சூழல் தேவை.',
      tl: 'Kandippa. Munnadi training experience thevai illa — beginners *Foundation of Facilitation* module-la start panni valaruvanga.\n\nStart panna munnadi ellam theriya vendiya avasiyam illa. Kakka, practice panna, valara correct-aana environment thaan thevai.',
    },
  },
  {
    id: 'experienced-trainer',
    label: 'Experienced trainer — what for me',
    group: 'fit',
    patterns: [
      /\b(?:i'?m|i am|am an?) (?:already )?(?:experienced|senior|professional) (?:trainer|facilitator)\b/i,
      /\b\d+\+? years? (?:of )?experience\b/i,
      /\bwhat'?s in it for me\b|\bwhy would i\b.*\bexperienced\b/i,
      /\bi (?:already )?(?:conduct|do|run|deliver) (?:training|workshops|sessions)\b/i,
    ],
    reply: {
      en: 'Quite a lot. Many experienced trainers know their subject well but want to strengthen what sits around it:\n\n• Designing structured learning experiences\n• Debriefing powerfully\n• Handling difficult participants\n• Positioning and marketing yourself\n• Writing proposals that win work\n\nPlus the Mastermind and Masterclass conversations with other experienced facilitators.',
      tl: 'Niraya irukku. Palaru subject nalla theriyum, aana adha suthi irukkuradha strengthen panna virumbuvanga:\n\n• Structured learning experiences design panradhu\n• Powerful-a debrief panradhu\n• Difficult participants-a handle panradhu\n• Self positioning and marketing\n• Work vaanga proposals ezhudhuradhu\n\nKoodave Mastermind and Masterclass conversations — vera experienced facilitators kooda.',
    },
  },
  {
    id: 'hr-ld',
    label: 'HR / L&D relevance',
    group: 'fit',
    patterns: [
      /\b(?:i'?m|i am)\s+(?:in|from|working in) (?:hr|l ?& ?d|learning and development|people team)\b/i,
      /\b(?:hr|l ?& ?d) (?:professional|manager|executive|head)\b/i,
      /\bis (?:it|this) relevant for hr\b/i,
    ],
    reply: {
      en: 'Yes. HR and L&D professionals join FSP to strengthen their ability to facilitate learning experiences rather than only organise them — learning design, activity facilitation, engagement and debriefing.',
      tl: 'Aama. HR and L&D professionals FSP join pandradhu — learning experiences-a summa organise panradhu mattum illama, adha facilitate panra thiramaya strengthen panna. Learning design, activity facilitation, engagement, debriefing.',
    },
  },
  {
    id: 'other-profession',
    label: 'Student / teacher / coach / consultant',
    group: 'fit',
    patterns: [
      /\b(?:i'?m|i am)\s+(?:a )?(?:college )?student\b|\bstudying\b|\bfinal year\b/i,
      /\b(?:i'?m|i am)\s+(?:a )?(?:school )?teacher\b|\blecturer\b|\bprofessor\b/i,
      /\b(?:i'?m|i am)\s+(?:a )?(?:life )?coach\b|\b(?:i'?m|i am)\s+(?:a )?consultant\b|\bcounsel?lor\b/i,
      /\b(?:i'?m|i am)\s+(?:a )?(?:housewife|homemaker|engineer|doctor|sales)\b/i,
    ],
    captures: 'goal',
    reply: {
      en: 'FSP is designed for trainers, facilitators, aspiring facilitators and HR/L&D professionals. If facilitating learning experiences is part of where you’re heading, the foundation will serve you well.\n\nTell me a little about what you’re working towards and I’ll be honest about whether it’s the right fit.',
      tl: 'FSP design aanadhu trainers, facilitators, aspiring facilitators, and HR/L&D professionals-ku. Learning experiences facilitate panradhu unga direction-la irundha, indha foundation nalla help pannum.\n\nNeenga edhuku work pandringa-nu konjam sollunga — right fit-a illaya-nu honest-a solren.',
    },
  },
  {
    id: 'age-qualification',
    label: 'Age limit or qualification',
    group: 'fit',
    patterns: [
      /\bage (?:limit|criteria|requirement)\b|\bhow old\b|\bminimum age\b/i,
      /\b(?:qualification|degree|education) (?:required|needed|criteria)\b/i,
      /\bdo i need (?:a )?degree\b|\bgraduation (?:required|needed)\b/i,
    ],
    reply: {
      en: 'There’s no stated academic requirement — what matters is the intent to become a better facilitator. For anything specific to your situation, I’ll connect with our team and the team will get back to you.',
      tl: 'Specific-a academic requirement edhuvum illa — nalla facilitator aaganum-nu intent irundha podhum. Unga situation-ku specific-aana edhuvum irundha, naan team kooda connect panren, avanga ungalai contact pannuvanga.',
    },
  },
  {
    id: 'only-facilitation',
    label: 'Is FSP only about facilitation',
    group: 'fit',
    patterns: [
      /\bonly (?:about )?facilitation\b|\bjust facilitation\b/i,
      /\bdoes (?:it|fsp) (?:also )?(?:cover|include|teach)\b/i,
      /\bwhat (?:all )?(?:topics|subjects|areas)\b/i,
    ],
    reply: {
      en: 'No. FSP covers facilitation, experiential learning, training design, personal branding, marketing, proposals and professional growth.',
      tl: 'Illa. FSP-la facilitation, experiential learning, training design, personal branding, marketing, proposals, and professional growth — ellam cover aagum.',
    },
  },

  /* ── 6.3 Programs ──────────────────────────────────────── */
  {
    id: 'core-program',
    label: 'Core Program',
    group: 'programs',
    weight: 1.3,
    patterns: [
      /\bcore (?:program|programme|course)\b|\bfsp core\b/i,
      /\bwhat (?:does|do) (?:the )?core\b|\bmodules?\b/i,
      /\bsyllabus\b|\bcurriculum\b|\bwhat will i learn\b|\btopics covered\b/i,
      /\bmodule 1\b|\bmodule 2\b|\bmodule 3\b|\bfoundation of facilitation\b/i,
    ],
    captures: 'goal',
    reply: {
      en: 'The *FSP Core Program* is where the journey begins — three modules:\n\n*Module 1 — Foundation of Facilitation*\nFacilitator mindset, experiential learning, activity facilitation, participant engagement, debriefing, communication, facilitation practice.\n\n*Module 2 — Build Your Training*\nTraining design, learning objectives, activity design, session flow, module creation, workbook creation, practical facilitation.\n\n*Module 3 — Build Your Brand & Opportunities*\nPersonal branding, trainer positioning, marketing, proposal creation, client communication, content creation, building your trainer business.\n\nWhich of these three is most urgent for you right now?',
      tl: '*FSP Core Program* thaan journey start aagura place — moonu modules:\n\n*Module 1 — Foundation of Facilitation*\nFacilitator mindset, experiential learning, activity facilitation, participant engagement, debriefing, communication, facilitation practice.\n\n*Module 2 — Build Your Training*\nTraining design, learning objectives, activity design, session flow, module creation, workbook creation, practical facilitation.\n\n*Module 3 — Build Your Brand & Opportunities*\nPersonal branding, trainer positioning, marketing, proposal creation, client communication, content creation, trainer business build panradhu.\n\nIndha moonula ungaluku ippo edhu romba urgent?',
    },
  },
  {
    id: '30-days',
    label: '30 Days Challenge',
    group: 'programs',
    weight: 1.3,
    patterns: [
      /\b30 ?days? (?:challenge|program)\b|\bthirty days\b/i,
      /\b30 ?tasks?\b|\b30 ?day challenge\b/i,
    ],
    reply: {
      en: '*30 Days. 30 Tasks. One Better Facilitator.*\n\nRoughly 30 minutes a day, one practical task a day, one step forward a day — across facilitation, communication, creativity, personal branding, content creation, learning design and reflection.\n\nThe real goal isn’t finishing 30 tasks. It’s building the habit of learning and practising every day.',
      tl: '*30 Days. 30 Tasks. One Better Facilitator.*\n\nOru naalaiku roughly 30 minutes, oru practical task, oru step munnadi — facilitation, communication, creativity, personal branding, content creation, learning design, and reflection-la.\n\nReal goal 30 tasks mudikradhu illa. Dhinam kakkura, practice panra habit build panradhu.',
    },
  },
  {
    id: 'good-to-great',
    label: 'Good to Great Facilitator / certification',
    group: 'programs',
    patterns: [
      /\bgood to great\b|\bg2g\b/i,
      /\bcertification journey\b/i,
      /\bcertificate\b(?!.*\b(?:valid|recognis|recogniz|accredit|government|govt)\b)/i,
      /\bdo (?:i|we) get (?:a )?certificate\b/i,
    ],
    reply: {
      en: "It’s the FSP certification journey, built around a simple loop:\n\n*Learning → Practice → Reflection → Feedback → Improvement*\n\nIt recognises your commitment to continuous learning and practical application. As we say inside FSP — _the certificate is a milestone, the growth is the journey._",
      tl: "Idhu FSP-yin certification journey, oru simple loop base-la:\n\n*Learning → Practice → Reflection → Feedback → Improvement*\n\nContinuous learning and practical application-ku unga commitment-a idhu recognise pannum. FSP-la naanga solluvom — _certificate oru milestone, growth thaan journey._",
    },
  },
  {
    id: 'ttx',
    label: 'FSP TTX',
    group: 'programs',
    weight: 1.3,
    patterns: [/\bttx\b|\bt ?t ?x\b/i, /\bresidential\b.*\b(?:what|about|program)\b/i],
    reply: {
      en: '*FSP TTX* is a 2-day transformational residential experience — you step away from your routine and into an immersive one.\n\nLearning · Challenge · Connection · Reflection · Growth\n\nTwo days. One experience. New perspectives.',
      tl: '*FSP TTX* na oru 2-day transformational residential experience — routine-la irunthu veliya vanthu, oru immersive experience-ku pogureenga.\n\nLearning · Challenge · Connection · Reflection · Growth\n\nRendu naal. Oru experience. Pudhu perspectives.',
    },
  },
  {
    id: 'masterclass',
    label: 'Wednesday Masterclass',
    group: 'programs',
    weight: 1.2,
    patterns: [/\bmasterclass\b|\bmaster class\b|\bwednesday (?:session|class)\b/i],
    reply: {
      en: '*Learn something. Apply something. Every time.*\n\nA regular session on practical topics — facilitation skills, handling difficult participants, training design, workbook creation, personal branding, marketing, content creation, business development and experiential learning.',
      tl: '*Learn something. Apply something. Every time.*\n\nPractical topics mela oru regular session — facilitation skills, difficult participants handle panradhu, training design, workbook creation, personal branding, marketing, content creation, business development, experiential learning.',
    },
  },
  {
    id: 'mastermind',
    label: 'FSP Mastermind',
    group: 'programs',
    weight: 1.2,
    patterns: [/\bmastermind\b|\bmaster mind\b/i],
    reply: {
      en: '*Conversations that make you think differently.*\n\nExperienced professionals and facilitators together on topics like leadership, AI & facilitation, learning & development, personal branding, trainer business and the future of facilitation.\n\nIt’s about thinking, questioning, sharing and learning together.',
      tl: '*Conversations that make you think differently.*\n\nExperienced professionals and facilitators sernthu — leadership, AI & facilitation, learning & development, personal branding, trainer business, and future of facilitation pola topics pathi pesuvom.\n\nYosikradhu, kelvi kekradhu, share panradhu, sernthu kakkuradhu.',
    },
  },
  {
    id: 'catalyst-connect',
    label: 'Catalyst Connect',
    group: 'programs',
    weight: 1.2,
    patterns: [/\bcatalyst\b|\bcatalyst connect\b/i],
    reply: {
      en: '*Connect. Learn. Collaborate.*\n\nA community experience that brings FSP members together beyond the virtual environment — meet fellow facilitators, exchange ideas, build relationships, share experiences and explore collaborations.',
      tl: '*Connect. Learn. Collaborate.*\n\nFSP members-a virtual environment-ku veliya sernthu konduvarra oru community experience — fellow facilitators-a meet pannunga, ideas exchange pannunga, relationships build pannunga, experiences share pannunga, collaborations explore pannunga.',
    },
  },
  {
    id: 'tbd-programs',
    label: 'GTX / Habit Circle / Fun Day',
    group: 'programs',
    weight: 1.3,
    patterns: [/\bgtx\b/i, /\bhabit circle\b/i, /\bfun day\b|\bfunday\b/i],
    reply: {
      en: 'These are part of the FSP ecosystem and details are being finalised. I’ll connect with our team and the team will get back to you with the latest on it.',
      tl: 'Idhu ellam FSP ecosystem-la part, details finalise aagi varudhu. Naan team kooda connect panren, latest details-oda avanga ungalai contact pannuvanga.',
    },
  },
  {
    id: 'resources',
    label: 'Resources / toolkit',
    group: 'programs',
    patterns: [
      /\bresources?\b|\btoolkit\b|\btool kit\b/i,
      /\btemplates?\b|\bworkbook\b|\bgame videos?\b|\bworksheets?\b/i,
      /\bwhat (?:do i|will i) get\b/i,
    ],
    reply: {
      en: 'Your facilitator toolkit — activity ideas, game videos, training templates, session formats, worksheets, workbooks, proposal templates, branding resources, learning resources and facilitation tools. 50+ resources and game videos currently.',
      tl: 'Unga facilitator toolkit — activity ideas, game videos, training templates, session formats, worksheets, workbooks, proposal templates, branding resources, learning resources, and facilitation tools. Ippo 50+ resources and game videos irukku.',
    },
  },
  {
    id: 'challenges',
    label: 'Challenges',
    group: 'programs',
    patterns: [
      /\bchallenges?\b(?!.*\b30\b)/i,
      /\b21 ?days? (?:habit )?challenge\b|\bhabit challenge\b/i,
      /\bbook reading\b|\breading challenge\b/i,
    ],
    reply: {
      en: 'Three, all action-based:\n• *21-Day Habit Challenge* — build better professional and personal habits\n• *30 Days Challenge* — 30 practical facilitator tasks in 30 days\n• *Book Reading Challenge* — read, reflect and discuss\n\n_Don’t just learn. Apply._',
      tl: 'Moonu, ellame action-based:\n• *21-Day Habit Challenge* — better professional and personal habits build pannunga\n• *30 Days Challenge* — 30 naalla 30 practical facilitator tasks\n• *Book Reading Challenge* — padinga, reflect pannunga, discuss pannunga\n\n_Summa kakka vendam. Apply pannunga._',
    },
  },
  {
    id: 'community',
    label: 'Is there a community',
    group: 'programs',
    patterns: [
      /\bcommunity\b(?!.*\b(?:size|how (?:big|many))\b)/i,
      /\bgroup\b.*\b(?:join|part of|member)\b|\bnetwork(?:ing)?\b/i,
      /\bpeer learning\b|\bsupport group\b/i,
    ],
    reply: {
      en: 'Yes — community is a core part of the FSP ecosystem: knowledge sharing, peer learning, masterclasses, mastermind sessions, challenges, resources, networking, collaboration and professional opportunities.\n\nYou don’t have to grow alone.',
      tl: 'Aama — community thaan FSP ecosystem-in core part: knowledge sharing, peer learning, masterclasses, mastermind sessions, challenges, resources, networking, collaboration, and professional opportunities.\n\nNeenga thaniya valara vendiya avasiyam illa.',
    },
  },
  {
    id: 'which-program',
    label: 'Which program should I start with',
    group: 'programs',
    weight: 1.2,
    patterns: [
      /\bwhich (?:program|programme|course|one)\b.*\b(?:start|begin|choose|pick|suit|best|first)\b/i,
      /\bwhere (?:do|should) i start\b|\bhow (?:do|should) i start\b/i,
      /\bwhat (?:do you|would you) (?:recommend|suggest)\b/i,
      /\bbest (?:program|option) for me\b/i,
      /\bedhula start\b|\bedhu best\b/i,
    ],
    captures: 'profile',
    reply: {
      en: 'For most people the *FSP Core Program* is the right starting point — it builds the foundation everything else sits on.\n\nTell me where you are right now — just starting out, already training, or training but struggling to get opportunities?',
      tl: 'Pala perukkum *FSP Core Program* thaan correct starting point — mathathellam idhu mela thaan ukkarudhu.\n\nNeenga ippo enga irukeenga-nu sollunga — just start pandringala, already training pandringala, illa training pandringa aana opportunities kidaikale-nu irukka?',
    },
  },

  /* ── 6.5 Objection handling ────────────────────────────── */
  {
    id: 'obj-expensive',
    label: 'Objection: too expensive',
    group: 'objection',
    weight: 1.5,
    patterns: [
      /\btoo (?:expensive|costly|high|much)\b|\bvery (?:expensive|costly)\b/i,
      /\bcan'?t afford\b|\bcannot afford\b|\bout of my budget\b|\bbeyond my budget\b/i,
      /\bbit (?:high|much)\b|\breduce\b.*\b(?:amount|a bit)\b/i,
    ],
    reply: {
      en: 'I hear you — and I don’t handle the numbers side here, so I won’t guess.\n\nWhat I can tell you is what you’re building: facilitation skill, your own training modules, a personal brand, and the ability to create your own opportunities. For most members that’s a professional capability, not a one-time expense.\n\nI’ll connect with our team and the team will get back to you with the details so you can decide properly.',
      tl: 'Puriyudhu — numbers side-a naan inga handle panna maaten, so guess panna maaten.\n\nNaan sollura vishayam — neenga build panradhu enna: facilitation skill, unga sontha training modules, oru personal brand, and unga sontha opportunities create panra thiramai. Pala members-ku idhu oru professional capability, one-time expense illa.\n\nNaan team kooda connect panren, details-oda avanga ungalai contact pannuvanga — nalla yosichu decide pannunga.',
    },
  },
  {
    id: 'obj-no-time',
    label: "Objection: no time",
    group: 'objection',
    weight: 1.4,
    patterns: [
      /\bno time\b|\bnot enough time\b|\bbusy schedule\b|\btoo busy\b/i,
      /\b(?:do not|does not|doesn'?t|don'?t|dont|cannot|can'?t|won'?t) have (?:any |the |enough )?time\b/i,
      /\bi (?:am|'m) busy\b|\bwork pressure\b/i,
      /\bneram illa\b|\btime illa\b/i,
    ],
    reply: {
      en: 'That’s exactly why FSP is built around small, practical action — the 30 Days Challenge is about *30 minutes a day*.\n\nSmall actions. Consistent practice. Meaningful growth.',
      tl: 'Adhan karanam — FSP small, practical action base-la build aagirukku. 30 Days Challenge na *oru naalaiku 30 minutes* mattum.\n\nSmall actions. Consistent practice. Meaningful growth.',
    },
  },
  {
    id: 'obj-think',
    label: 'Objection: let me think',
    group: 'objection',
    weight: 1.3,
    patterns: [
      /\b(?:let me|i'?ll|i will) think\b|\bthink (?:about it|and tell)\b|\bneed (?:some )?time to (?:think|decide)\b/i,
      /\bi'?ll get back\b|\blet you know later\b|\bconsider\b.*\btell you\b/i,
      /\byosichu solren\b|\byosikren\b/i,
    ],
    captures: 'name',
    reply: {
      en: 'Of course — take your time.\n\nCan I share your details with our team so they can answer anything specific when you’re ready? No pressure at all.',
      tl: 'Kandippa — neram eduthukonga.\n\nUnga details-a team-kitta share pannalama? Neenga ready aana podhu specific-aana kelvi-ku avanga badhil solluvanga. Pressure edhuvum illa.',
    },
  },
  {
    id: 'obj-guarantee',
    label: 'Objection: will I get clients/job',
    group: 'objection',
    weight: 1.4,
    patterns: [
      /\b(?:will|can) i (?:definitely )?get\b.*\b(?:clients?|jobs?|work|projects?|placement|income|salary)\b/i,
      /\bguarantee\w*\b|\bassured?\b|\bsure shot\b/i,
      /\bplacement\b|\bjob after\b|\bincome after\b/i,
      /\bhow much (?:can i|will i) earn\b/i,
    ],
    reply: {
      en: 'I won’t promise you outcomes — that wouldn’t be fair to you.\n\nWhat FSP gives you is the capability and the ecosystem: positioning, marketing, proposal creation, client communication, and a 1000+ member community where opportunities get shared. What you build with it is yours.',
      tl: 'Outcomes-a naan promise panna maaten — adhu ungaluku fair-a irukkadhu.\n\nFSP ungaluku kudukuradhu capability and ecosystem: positioning, marketing, proposal creation, client communication, and 1000+ member community — anga opportunities share aagum. Adha vechu neenga build panradhu ungaludhu.',
    },
  },
  {
    id: 'obj-free-trial',
    label: 'Objection: free trial or sample',
    group: 'objection',
    weight: 1.4,
    patterns: [
      /\bfree (?:trial|demo|sample|session|class|access)\b|\btrial class\b|\bdemo (?:class|session)\b/i,
      /\bcan i (?:try|test) (?:it )?(?:first|before)\b/i,
      /\bsample (?:content|material|video)\b/i,
      /\bfree-?a\b|\bfree ah\b/i,
    ],
    reply: {
      en: 'FSP shares free learning through the community, masterclasses and resources.\n\nFor anything specific to joining, I’ll connect with our team and the team will get back to you.',
      tl: 'FSP community, masterclasses, and resources moolama free learning share pannudhu.\n\nJoin panradhu pathi specific-aana edhuvum irundha, naan team kooda connect panren, avanga ungalai contact pannuvanga.',
    },
  },
  {
    id: 'obj-later',
    label: 'Objection: join later',
    group: 'objection',
    weight: 1.3,
    patterns: [
      /\b(?:join|start)\b.*\b(?:later|next (?:month|year|batch|time)|after some time|afterwards)\b/i,
      /\bnot (?:right )?now\b|\bsome other time\b|\bfuture-?la\b/i,
      /\baprama\b|\bapram\b|\bnext month\b/i,
    ],
    captures: 'name',
    reply: {
      en: 'That works. FSP isn’t a one-time intake — it’s a continuing ecosystem.\n\nShall I keep your details with the team so they can update you when something relevant comes up?',
      tl: 'Seri, nalladhu. FSP oru one-time intake illa — idhu oru continuing ecosystem.\n\nUnga details-a team-kitta vechukalama? Relevant-a edhuvum vandha avanga ungaluku update pannuvanga.',
    },
  },
  {
    id: 'obj-cheaper',
    label: 'Objection: cheaper elsewhere',
    group: 'objection',
    weight: 1.5,
    patterns: [
      /\b(?:someone|others?|another|other place)\b.*\b(?:cheaper|less|lower|same thing)\b/i,
      /\bcheaper (?:elsewhere|outside|somewhere)\b/i,
      /\bcompar\w*\b.*\b(?:other|another|competitor)\b/i,
      /\bwhy (?:is it|are you) (?:more )?(?:expensive|costly) than\b/i,
    ],
    reply: {
      en: 'Fair to compare. The difference people usually point to is that FSP isn’t only training — it’s practice, creation, branding, community and continuous growth together, led by a facilitator with 10+ years and 1 Lakh+ people trained.\n\nI’d rather you decide with the full picture. I’ll connect with our team and the team will get back to you.',
      tl: 'Compare panradhu fair. Pala peru sollura difference — FSP summa training illa. Practice, creation, branding, community, and continuous growth ellam sernthu. Idha nadathuradhu 10+ years experience, 1 Lakh+ people trained-aana oru facilitator.\n\nFull picture-oda neenga decide panradhu thaan nalladhu. Naan team kooda connect panren, avanga ungalai contact pannuvanga.',
    },
  },
  {
    id: 'obj-scam',
    label: 'Objection: scam / MLM',
    group: 'objection',
    weight: 1.6,
    patterns: [
      /\b(?:is (?:this|it) a )?(?:scam|fraud|fake|cheating)\b/i,
      /\bmlm\b|\bnetwork marketing\b|\bchain (?:system|marketing)\b|\bpyramid\b/i,
      /\bhow (?:do i|can i) trust\b|\bcan i trust\b/i,
    ],
    reply: {
      en: 'Not at all — FSP is a facilitation learning and growth program. You can see the programs, the community and the founder’s background on our website and social channels:\n{{site}}\n\nAnd an important note: FSP never asks for payment through this chat. If anyone sends you a payment link here, please don’t act on it.',
      tl: 'Illa illa — FSP oru facilitation learning and growth program. Programs, community, and founder-in background namma website and social channels-la paakalaam:\n{{site}}\n\nOru important note: FSP indha chat vazhiya epavum paisa kekadhu. Yaaravadhu inga link anuppina, adha nambi edhuvum panna vendam.',
    },
  },
  {
    id: 'obj-tried-before',
    label: 'Objection: tried similar before',
    group: 'objection',
    weight: 1.4,
    patterns: [
      /\b(?:tried|did|attended|joined)\b.*\b(?:similar|another|other|before|previously|earlier)\b/i,
      /\bdidn'?t (?:help|work|benefit)\b|\bno (?:use|benefit|value)\b|\bwaste\b.*\bbefore\b/i,
      /\bi have done (?:a |one )?(?:course|program|training)\b/i,
    ],
    captures: 'goal',
    reply: {
      en: 'That’s fair, and worth saying out loud.\n\nThe usual gap is that learning stops at knowledge. FSP is built around applying — practice, assignments, creating your own modules, 30-day challenges, and a community that keeps you accountable.\n\nWhat specifically was missing last time? That’ll tell us whether FSP actually fixes it for you.',
      tl: 'Adhu fair, sollirukeenga nalladhu.\n\nUsual-a aagura gap — learning knowledge-la nikkudhu. FSP apply panradhu suthi build aagirukku — practice, assignments, sontha modules create panradhu, 30-day challenges, and ungala accountable-a vaikkura oru community.\n\nLast time specific-a enna miss aachu? Adhu sollum FSP ungaluku adha fix pannuma-nu.',
    },
  },
];

/** Case-insensitive lookup for the dashboard. */
export function intentById(id: string): Intent | undefined {
  return INTENTS.find((i) => i.id === id);
}
