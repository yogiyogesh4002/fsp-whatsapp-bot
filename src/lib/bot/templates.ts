import type { Lang } from './language';

export type Reply = { en: string; ta?: string; tl?: string };

/** Pick the customer's language, falling back to English when a translation
 *  for that intent has not been authored yet. */
export function pick(reply: Reply, lang: Lang): string {
  if (lang === 'ta' && reply.ta) return reply.ta;
  if (lang === 'tl' && reply.tl) return reply.tl;
  return reply.en;
}

/* ── Section 4: the handoff message ───────────────────────── */

/** Canonical handoff, used when name + city are not yet known. */
export const HANDOFF_ASK: Reply = {
  en: "I'll connect with our team and the team will get back to you shortly.\n\nCould you share your *name* and *city* so I can pass it on correctly?",
  ta: 'நான் எங்கள் டீமுடன் உங்களை இணைக்கிறேன், அவர்கள் விரைவில் உங்களைத் தொடர்பு கொள்வார்கள்.\n\nஉங்கள் *பெயர்* மற்றும் *ஊர்* சொல்ல முடியுமா? சரியாக டீமுக்கு அனுப்பி வைக்கிறேன்.',
  tl: 'Naan namma team kooda connect panren, team seekiram ungalai contact pannuvanga.\n\nUnga *peru* and *city* sollunga — team-ku correct-a pass panniduven.',
};

/** Short form, when name and city are already captured. */
export const HANDOFF_SHORT: Reply = {
  en: "I'll connect with our team and the team will get back to you shortly, {{name}}.",
  ta: 'நான் எங்கள் டீமுடன் உங்களை இணைக்கிறேன் {{name}}, அவர்கள் விரைவில் உங்களைத் தொடர்பு கொள்வார்கள்.',
  tl: 'Naan namma team kooda connect panren {{name}}, team seekiram ungalai contact pannuvanga.',
};

/** Section 4 "Deflect, don't invent" — triggers 3, 4, 5 and 11. */
export const DEFLECT_PREFIX: Reply = {
  en: 'Great question. The team shares confirmed details directly so you get the current information —',
  ta: 'நல்ல கேள்வி. சரியான, தற்போதைய விவரங்களை டீம் நேரடியாகப் பங்கிடுவார்கள் —',
  tl: 'Nalla kelvi. Correct-aana, latest details-a team direct-a share pannuvanga —',
};

/** Trigger 1 — the fee deflection wording from section 6.4. */
export const DEFLECT_FEES: Reply = {
  en: 'The team shares the current investment details directly so you get accurate, up-to-date information.',
  ta: 'தற்போதைய விவரங்களை டீம் நேரடியாகப் பங்கிடுவார்கள், அதனால் உங்களுக்குச் சரியான தகவல் கிடைக்கும்.',
  tl: 'Latest details ellam team direct-a share pannuvanga, adhanala ungaluku accurate info kidaikum.',
};

/** Trigger 2 — payments. */
export const DEFLECT_PAYMENT: Reply = {
  en: "I don't handle payments here. I'll connect with our team and the team will get back to you with the verified details.",
  ta: 'பணப் பரிவர்த்தனைகளை நான் இங்கே கையாளவில்லை. நான் எங்கள் டீமுடன் உங்களை இணைக்கிறேன், சரிபார்க்கப்பட்ட விவரங்களுடன் அவர்கள் உங்களைத் தொடர்பு கொள்வார்கள்.',
  tl: "Payment-a naan inga handle panna maaten. Naan namma team kooda connect panren, verified details-oda team ungalai contact pannuvanga.",
};

/** Section 3 security line — someone claims they got a payment link in chat. */
export const PAYMENT_SECURITY: Reply = {
  en: "FSP never shares payment details through this chat. Please don't make any payment based on a message here.\n\nI'll connect with our team and the team will get back to you with the verified details.",
  ta: 'FSP இந்த chat வழியாக பணம் தொடர்பான விவரங்களை ஒருபோதும் பங்கிடுவதில்லை. இங்கே வரும் செய்தியை நம்பி எந்தப் பணப் பரிவர்த்தனையும் செய்ய வேண்டாம்.\n\nநான் எங்கள் டீமுடன் உங்களை இணைக்கிறேன், சரிபார்க்கப்பட்ட விவரங்களுடன் அவர்கள் தொடர்பு கொள்வார்கள்.',
  tl: "FSP indha chat-la payment details epavum share panna maatom. Inga varra message-a nambi edhuvum pay panna vendam.\n\nNaan namma team kooda connect panren, verified details-oda team ungalai contact pannuvanga.",
};

/** Trigger 6 — booking a seat. */
export const DEFLECT_ENROL: Reply = {
  en: "Wonderful. I'll connect with our team and the team will get back to you to take it forward.",
  ta: 'அருமை! நான் எங்கள் டீமுடன் உங்களை இணைக்கிறேன், அடுத்த கட்டத்திற்கு அவர்கள் உங்களைத் தொடர்பு கொள்வார்கள்.',
  tl: 'Super! Naan namma team kooda connect panren, adutha step-ku team ungalai contact pannuvanga.',
};

/** Trigger 12 — abuse. Sent once, then the bot stops replying. */
export const ABUSE_STOP: Reply = {
  en: "I'd like to help, but let's keep this respectful. I'll connect with our team and the team will get back to you.",
  ta: 'உதவ விரும்புகிறேன், ஆனால் இதை மரியாதையாக வைத்துக்கொள்வோம். நான் எங்கள் டீமுடன் உங்களை இணைக்கிறேன், அவர்கள் உங்களைத் தொடர்பு கொள்வார்கள்.',
  tl: "Help panna aasai, aana idha respect-a vaipom. Naan namma team kooda connect panren, team ungalai contact pannuvanga.",
};

/* ── Section 8: message templates ─────────────────────────── */

export const GREETING: Reply = {
  en: "Hello! Welcome to *FSP — Facilitator Support Program*.\nI'm Jarvis, your FSP assistant.\n\nFSP helps trainers and facilitators improve their facilitation skills, build their personal brand and create more opportunities. _Learn. Lead. Impact._\n\nMay I know your name, and what brings you here today?",
  ta: 'வணக்கம்! *FSP — Facilitator Support Program*-க்கு வருக.\nநான் Jarvis, உங்கள் FSP assistant.\n\nபயிற்சியாளர்கள் மற்றும் facilitators-க்கு facilitation திறனை மேம்படுத்த, personal brand உருவாக்க, அதிக வாய்ப்புகளை உருவாக்க FSP உதவுகிறது. _Learn. Lead. Impact._\n\nஉங்கள் பெயர் தெரிந்துகொள்ளலாமா? இன்று எப்படி உதவ முடியும்?',
  tl: "Vanakkam! Welcome to *FSP — Facilitator Support Program*.\nNaan Jarvis, unga FSP assistant.\n\nTrainers and facilitators-ku facilitation skill improve panna, personal brand build panna, and more opportunities create panna FSP help pannum. _Learn. Lead. Impact._\n\nUnga peru theriyalama? Innaiku eppadi help panna mudiyum?",
};

export const RETURNING: Reply = {
  en: 'Welcome back, {{name}}! How can I help you with FSP today?',
  ta: 'மீண்டும் வருக {{name}}! இன்று FSP பற்றி எப்படி உதவ முடியும்?',
  tl: 'Welcome back {{name}}! Innaiku FSP pathi eppadi help panna mudiyum?',
};

export const OUT_OF_HOURS: Reply = {
  en: "Thanks for messaging, {{name}}! I can answer your FSP questions right now. For anything the team needs to confirm, I'll pass it on and the team will get back to you during working hours.",
  ta: 'செய்தி அனுப்பியதற்கு நன்றி {{name}}! உங்கள் FSP கேள்விகளுக்கு இப்போதே பதில் சொல்ல முடியும். டீம் உறுதிப்படுத்த வேண்டியவற்றை அவர்களுக்கு அனுப்பி வைக்கிறேன், working hours-ல் அவர்கள் தொடர்பு கொள்வார்கள்.',
  tl: "Message anupinadhuku nandri {{name}}! Unga FSP kelvi-ku ippove badhil solren. Team confirm panna vendiyadha avangaluku pass panniduven, working hours-la avanga contact pannuvanga.",
};

export const FOLLOWUP: Reply = {
  en: "Hi {{name}} — just checking in. Is there anything else you'd like to know about FSP? Happy to help whenever you're ready.",
  ta: 'வணக்கம் {{name}} — சும்மா ஒரு check-in. FSP பற்றி வேறு எதுவும் தெரிந்துகொள்ள விரும்புகிறீர்களா? நீங்கள் தயாராக இருக்கும்போது உதவ மகிழ்ச்சி.',
  tl: "Hi {{name}} — summa oru check-in. FSP pathi vera edhuvum theriyanuma? Neenga ready aana podhu sollunga, help panren.",
};

export const POST_HANDOFF: Reply = {
  en: "All set, {{name}}. I've shared your details with our team and the team will get back to you shortly.\n\nIn the meantime, feel free to ask me anything about the programs.",
  ta: 'சரி {{name}}. உங்கள் விவரங்களை டீமுக்கு அனுப்பி விட்டேன், அவர்கள் விரைவில் தொடர்பு கொள்வார்கள்.\n\nஅதுவரை programs பற்றி எதுவும் கேட்கலாம்.',
  tl: "Set {{name}}. Unga details-a team-ku share panniten, avanga seekiram contact pannuvanga.\n\nAdhuvarai programs pathi edhuvum kelunga.",
};

/* ── Section 6.6: small talk and media ────────────────────── */

export const THANKS: Reply = {
  en: "Happy to help! Anything else you'd like to know about FSP?",
  ta: 'உதவ மகிழ்ச்சி! FSP பற்றி வேறு எதுவும் தெரிந்துகொள்ள வேண்டுமா?',
  tl: 'Happy to help! FSP pathi vera edhuvum theriyanuma?',
};

export const BYE: Reply = {
  en: 'Thank you for reaching out. Wishing you a great facilitation journey — _Learn. Lead. Impact._',
  ta: 'தொடர்பு கொண்டதற்கு நன்றி. உங்கள் facilitation பயணம் சிறப்பாக அமைய வாழ்த்துகள் — _Learn. Lead. Impact._',
  tl: 'Contact panninadhuku nandri. Unga facilitation journey super-a irukkum — _Learn. Lead. Impact._',
};

export const VOICE_NOTE: Reply = {
  en: "I can read text messages here. Could you type it for me? Or I can connect with our team and the team will get back to you.",
  ta: 'இங்கே text செய்திகளை மட்டும் படிக்க முடியும். தட்டச்சு செய்து அனுப்ப முடியுமா? அல்லது நான் டீமுடன் இணைக்கிறேன், அவர்கள் தொடர்பு கொள்வார்கள்.',
  tl: "Inga text message mattum padikka mudiyum. Type panni anuppureengala? Illana naan team kooda connect panren, avanga contact pannuvanga.",
};

export const MEDIA_RECEIVED: Reply = {
  en: "Thanks for sharing. I'll connect with our team and the team will get back to you on this.",
  ta: 'பங்கிட்டதற்கு நன்றி. நான் எங்கள் டீமுடன் உங்களை இணைக்கிறேன், இதுபற்றி அவர்கள் தொடர்பு கொள்வார்கள்.',
  tl: 'Share panninadhuku nandri. Naan namma team kooda connect panren, idhu pathi avanga contact pannuvanga.',
};

export const OFF_TOPIC: Reply = {
  en: "That's a bit outside what I can help with here. Happy to tell you anything about FSP though.",
  ta: 'அது நான் இங்கே உதவ முடியாத விஷயம். ஆனால் FSP பற்றி எதுவும் கேட்கலாம்.',
  tl: "Adhu naan inga help panna mudiyadha vishayam. Aana FSP pathi edhuvum kelunga.",
};

export const AM_I_HUMAN: Reply = {
  en: "I'm Jarvis, FSP's assistant. I can answer your FSP questions, and for anything specific I'll connect you with our team.",
  ta: 'நான் Jarvis, FSP-யின் assistant. உங்கள் FSP கேள்விகளுக்குப் பதில் சொல்ல முடியும், குறிப்பிட்ட விஷயங்களுக்கு டீமுடன் இணைக்கிறேன்.',
  tl: "Naan Jarvis, FSP-yin assistant. Unga FSP kelvi-ku badhil solluven, specific-aana vishayathuku team kooda connect panren.",
};

export const OTHER_CUSTOMER: Reply = {
  en: "I can't share anyone else's details.",
  ta: 'வேறு யாருடைய விவரங்களையும் என்னால் பங்கிட முடியாது.',
  tl: "Vera yaarudaiya details-um naan share panna mudiyadhu.",
};

export const NOT_INTERESTED: Reply = {
  en: 'No problem at all — thanks for letting me know. All the best!',
  ta: 'பிரச்சனை இல்லை — சொன்னதற்கு நன்றி. எல்லா நலமும் கிடைக்கட்டும்!',
  tl: 'No problem — sollinadhuku nandri. All the best!',
};
