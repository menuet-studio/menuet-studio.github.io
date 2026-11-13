// Fournisseur « démo » : règles simples, gratuit et hors ligne.
// Il sert aux tests, aux démonstrations et de secours si l'IA réelle est indisponible.
// Il est volontairement prudent : il ne promet rien et signale ce qu'il ne sait pas.

const STOPWORDS = {
  fr: ['bonjour', 'merci', 'commande', 'je', 'vous', 'mon', 'ma', 'est', 'pas', 'pour', 'avec', 'colis', 'quand'],
  en: ['hello', 'hi', 'thanks', 'order', 'my', 'the', 'is', 'not', 'where', 'please', 'you', 'when', 'package'],
  es: ['hola', 'gracias', 'pedido', 'mi', 'el', 'es', 'no', 'donde', 'por', 'favor', 'cuando', 'paquete'],
  de: ['hallo', 'danke', 'bestellung', 'mein', 'meine', 'ist', 'nicht', 'wo', 'bitte', 'wann', 'paket', 'ich'],
};

const RULES = [
  { category: 'cancellation', re: /\b(annul|cancel|anular|cancelar|stornier|widerruf)/i },
  { category: 'return_refund', re: /(rembours|retour|refund|return|devol|reembols|rückerstatt|rücksend|zurück|[ée]change|exchange|cass[ée]|abîm|damaged|broken|defekt|roto|dañado)/i },
  { category: 'order_change', re: /(changer|modifi|change my|wrong address|adresse|address|ändern|tauschen|cambiar|direcci)/i },
  { category: 'order_status', re: /(où est|ou est|where is|suivi|tracking|track|livr|deliver|shipped|exp[ée]di|reçu|received|recibido|dónde|donde está|envío|paquete|wo ist|lieferung|sendung|angekommen)/i },
  { category: 'complaint', re: /(inadmissible|scandal|déçu|decu|disappoint|terrible|horrible|unacceptable|nul|worst|enttäuscht|inaceptable|furious|furieux)/i },
  { category: 'product_question', re: /(stock|disponible|available|dispon|verfügbar|existe|exist|format|taille|size|talla|größe|matière|material|dimension|couleur|colou?r|combien|how long|how much|price|prix|precio|preis|\?)/i },
];

const ANGRY = /(inadmissible|scandal|unacceptable|furious|furieux|avocat|lawyer|plainte|chargeback|worst|arnaque|scam|betrug|estafa|!!!)/i;
const POSITIVE = /(merci beaucoup|thank you so much|love|adore|super|génial|great|perfect|parfait|genial|toll|wunderbar)/i;
const INJECTION = /(ignore (all|your|previous)|ignorez? (les|vos)|system prompt|tes instructions|your instructions|other customers|autres clients)/i;

export function detectLanguage(text) {
  const words = String(text).toLowerCase().match(/[a-zà-ÿßñ]+/g) || [];
  let best = 'en';
  let bestScore = 0;
  for (const [lang, list] of Object.entries(STOPWORDS)) {
    const score = words.filter((w) => list.includes(w)).length;
    if (score > bestScore) { best = lang; bestScore = score; }
  }
  return best;
}

export function extractOrderNumber(text) {
  const s = String(text);
  const patterns = [
    /#\s?([A-Z0-9-]{3,20})/i,
    /(?:commande|order|pedido|bestellung|bestellnummer|n°|no\.?|nr\.?)\s*(?:n°|no\.?|number|numéro|nummer|número)?\s*[:#]?\s*([A-Z]{0,4}-?\d{3,12})/i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m && /\d/.test(m[1])) return m[1].replace(/^#/, '');
  }
  return '';
}

const T = {
  fr: {
    hello: (n) => (n ? `Bonjour ${n},` : 'Bonjour,'),
    thanks: 'Merci pour votre message.',
    status: (o) => (o.tracking_number
      ? `Votre commande ${o.order_number} est au statut « ${o.statusLabel} ». Numéro de suivi${o.carrier ? ` (${o.carrier})` : ''} : ${o.tracking_number}.`
      : `Votre commande ${o.order_number} est au statut « ${o.statusLabel} ». Nous vous enverrons le numéro de suivi dès l'expédition.`),
    noOrder: "Pourriez-vous nous indiquer votre numéro de commande ? Nous pourrons ainsi vérifier rapidement.",
    passed: "Nous avons bien transmis votre demande à l'équipe, qui revient vers vous très vite.",
    checking: 'Nous vérifions et revenons vers vous rapidement.',
    sorry: 'Nous sommes désolés pour ce désagrément.',
    bye: 'Belle journée,',
  },
  en: {
    hello: (n) => (n ? `Hi ${n},` : 'Hello,'),
    thanks: 'Thank you for your message.',
    status: (o) => (o.tracking_number
      ? `Your order ${o.order_number} is currently "${o.statusLabel}". Tracking number${o.carrier ? ` (${o.carrier})` : ''}: ${o.tracking_number}.`
      : `Your order ${o.order_number} is currently "${o.statusLabel}". We will send you the tracking number as soon as it ships.`),
    noOrder: 'Could you send us your order number? That way we can check right away.',
    passed: 'We have passed your request on to the team and will get back to you very soon.',
    checking: 'We are checking and will get back to you shortly.',
    sorry: 'We are sorry for the inconvenience.',
    bye: 'Best regards,',
  },
  es: {
    hello: (n) => (n ? `Hola ${n}:` : 'Hola:'),
    thanks: 'Gracias por tu mensaje.',
    status: (o) => (o.tracking_number
      ? `Tu pedido ${o.order_number} está en estado «${o.statusLabel}». Número de seguimiento${o.carrier ? ` (${o.carrier})` : ''}: ${o.tracking_number}.`
      : `Tu pedido ${o.order_number} está en estado «${o.statusLabel}». Te enviaremos el número de seguimiento en cuanto salga.`),
    noOrder: '¿Podrías indicarnos tu número de pedido? Así lo revisamos enseguida.',
    passed: 'Hemos trasladado tu solicitud al equipo y te responderemos muy pronto.',
    checking: 'Lo estamos revisando y te respondemos en breve.',
    sorry: 'Sentimos mucho las molestias.',
    bye: 'Un saludo,',
  },
  de: {
    hello: (n) => (n ? `Hallo ${n},` : 'Hallo,'),
    thanks: 'Vielen Dank für Ihre Nachricht.',
    status: (o) => (o.tracking_number
      ? `Ihre Bestellung ${o.order_number} hat den Status „${o.statusLabel}“. Sendungsnummer${o.carrier ? ` (${o.carrier})` : ''}: ${o.tracking_number}.`
      : `Ihre Bestellung ${o.order_number} hat den Status „${o.statusLabel}“. Die Sendungsnummer schicken wir Ihnen, sobald sie versendet ist.`),
    noOrder: 'Könnten Sie uns Ihre Bestellnummer schicken? Dann prüfen wir das sofort.',
    passed: 'Wir haben Ihre Anfrage an das Team weitergegeben und melden uns sehr bald.',
    checking: 'Wir prüfen das und melden uns in Kürze.',
    sorry: 'Wir bitten die Unannehmlichkeiten zu entschuldigen.',
    bye: 'Viele Grüße,',
  },
};

const STATUS_LABELS = {
  fr: { pending: 'en attente', paid: 'payée', preparing: 'en préparation', shipped: 'expédiée', delivered: 'livrée', cancelled: 'annulée', refunded: 'remboursée' },
  en: { pending: 'pending', paid: 'paid', preparing: 'being prepared', shipped: 'shipped', delivered: 'delivered', cancelled: 'cancelled', refunded: 'refunded' },
  es: { pending: 'pendiente', paid: 'pagado', preparing: 'en preparación', shipped: 'enviado', delivered: 'entregado', cancelled: 'cancelado', refunded: 'reembolsado' },
  de: { pending: 'ausstehend', paid: 'bezahlt', preparing: 'in Vorbereitung', shipped: 'versendet', delivered: 'zugestellt', cancelled: 'storniert', refunded: 'erstattet' },
};

export function createDemoProvider() {
  return {
    name: 'demo',
    async analyze({ workspace, message, order }) {
      const text = `${message.subject || ''}\n${message.body}`;
      const language = detectLanguage(text);
      const t = T[language];
      const injection = INJECTION.test(text);
      const rule = injection ? null : RULES.find((r) => r.re.test(text));
      const category = rule?.category || 'other';
      const angry = ANGRY.test(text);
      const shippedAlready = order && ['shipped', 'delivered'].includes(order.status);
      const needsAction = ['order_change', 'cancellation', 'return_refund'].includes(category);
      const urgency = angry || (needsAction && !shippedAlready && category !== 'return_refund') || /damaged|cass|abîm|defekt|roto/i.test(text)
        ? 'high'
        : category === 'other' ? 'low' : 'normal';

      const firstName = String(message.customer_name || order?.customer_name || '').trim().split(/\s+/)[0] || '';
      const lines = [t.hello(firstName), '', t.thanks];
      const missing = [];

      if (angry || category === 'complaint') lines.push(t.sorry);
      if (category === 'order_status') {
        if (order) lines.push(t.status({ ...order, statusLabel: STATUS_LABELS[language][order.status] || order.status }));
        else { lines.push(t.noOrder); missing.push('Order number or matching order'); }
      } else if (needsAction) {
        if (!order) { lines.push(t.noOrder); missing.push('Order number or matching order'); }
        lines.push(t.passed);
      } else if (category === 'product_question') {
        lines.push(t.checking);
        missing.push('Product information to answer the question');
      } else {
        lines.push(t.checking);
      }
      lines.push('', t.bye, workspace.signature || workspace.name);

      return {
        analysis: {
          category,
          urgency: injection ? 'low' : urgency,
          needs_action: needsAction,
          action_reason: needsAction ? `Customer request: ${category.replace('_', ' ')}${shippedAlready ? ' (order already shipped)' : ''}.` : '',
          language,
          sentiment: angry ? 'negative' : POSITIVE.test(text) ? 'positive' : 'neutral',
          order_number: order?.order_number || extractOrderNumber(text),
          summary: injection
            ? 'Possible manipulation attempt; review manually.'
            : `Demo analysis: ${category.replace('_', ' ')} request${order ? ` about order ${order.order_number}` : ''}.`,
          draft_reply: lines.join('\n'),
          confidence: injection || !rule ? 'low' : 'medium',
          missing_info: missing,
        },
        usage: { input: 0, output: 0 },
      };
    },
  };
}
