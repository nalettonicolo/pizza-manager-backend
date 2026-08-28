import {
  PUBLIC_DOMAIN_CNAME_TARGET,
  PUBLIC_SAAS_BASE_URL,
} from "@/config/publicDomain"

/**
 * Guide DNS per registrar — testi Super Admin (go-live dominio menu).
 * Il target CNAME effettivo può variare: allinea sempre a quanto mostra Firebase Hosting.
 */

export const DNS_GENERIC_GUIDELINES = {
  title: "Linee guida generiche (tutti i registrar)",
  intro:
    "Il dominio menu del cliente apre la stessa webapp PizzaManager. Non serve un deploy Firebase per ogni nuovo hostname: salvi il dominio in piattaforma, lo aggiungi in Firebase Hosting e punti il DNS del cliente.",
  bullets: [
    "Distingui sempre dominio menu (webapp / ordini) da sito marketing esterno. Solo il dominio menu va in Firebase e nel campo «dominio pubblico».",
    "Preferisci un sottodominio dedicato: menu., ordina., ordini. — più semplice (CNAME) e non tocca il sito WordPress/HTML esistente sulla root.",
    "Se il cliente vuole la root (www.pizzeria.it o apex senza www), segui le istruzioni Firebase: spesso servono record A / ALIAS / ANAME, non solo CNAME.",
    "Hostname salvato in Super Admin = hostname aggiunto in Firebase = nome host nel record DNS (stesso testo, senza https://).",
    "Dopo il DNS: attesa propagazione (minuti–48 ore), certificato SSL green in Firebase, stato pubblicazione «Dominio online».",
    "Auth: per ogni dominio menu live aggiungi in Supabase → Authentication → Redirect URLs le voci https://<dominio>/reimposta-password (e login se richiesto).",
    "Deploy codice Firebase: solo per release prodotto. Aggiungere un dominio cliente non richiede nuovo deploy.",
    "CTA sul sito esterno («Ordina ora»): devono puntare al dominio menu (es. https://menu.cliente.it/ordina), non a pizzamanager.it, così l’utente resta sul brand del locale.",
  ],
  checklist: [
    "Slug tenant attivo e anteprima slug.pizzamanager.it ok",
    "Dominio pubblico salvato in Go-live",
    "Dominio aggiunto in Firebase Hosting",
    "Record DNS creati presso il registrar",
    "HTTPS attivo e pagina vetrina raggiungibile",
    "Redirect Auth aggiornati",
    "Stato pubblicazione = Dominio online",
    "Se esiste sito marketing: CTA Ordina allineate al dominio menu",
  ],
}

/** @typedef {{ id: string, label: string, panelUrl?: string, steps: string[], notes?: string[], recordsExample?: string }} DnsHostGuide */

/** @type {DnsHostGuide[]} */
export const DNS_HOST_GUIDES = [
  {
    id: "register",
    label: "Register.it",
    panelUrl: "https://www.register.it/",
    steps: [
      "Accedi a Register.it → Area clienti → Domini → seleziona il dominio del cliente.",
      "Apri «DNS e Name Server» (o «Gestione DNS avanzata»).",
      "Per un sottodominio (consigliato), crea un record di tipo CNAME.",
      "Host / Nome: la parte a sinistra del dominio (es. menu se l’hostname è menu.cliente.it). Su Register a volte si inserisce solo «menu», a volte «menu.cliente.it» — allinea al formato già usato negli altri record.",
      `Punta a / Valore: il target indicato da Firebase dopo «Aggiungi dominio» (di solito un host tipo ${PUBLIC_DOMAIN_CNAME_TARGET} o un *.web.app).`,
      "TTL: lascia il default (es. 1 ora) se non hai esigenze particolari.",
      "Salva e attendi la propagazione. In Firebase Hosting verifica che lo stato del dominio diventi Connected / Needs setup risolto.",
      "Se Firebase chiede anche un record TXT di verifica, aggiungilo nella stessa schermata DNS e attendi la conferma.",
    ],
    notes: [
      "Register a volte mostra «Record di risorse» e «DNS secondario»: lavora sulla zona primaria attiva.",
      "Se la root del dominio punta già al sito marketing, non sostituire i record A della root: usa menu. / ordina.",
      "Propagazione tipica Register: da pochi minuti a qualche ora.",
    ],
    recordsExample: `Tipo: CNAME
Host: menu
Valore: ${PUBLIC_DOMAIN_CNAME_TARGET}
(oppure il target esatto mostrato da Firebase)`,
  },
  {
    id: "aruba",
    label: "Aruba",
    panelUrl: "https://www.aruba.it/",
    steps: [
      "Accedi ad Aruba → «Area clienti» → «Domini» (o hosting associato) → gestione del dominio.",
      "Apri «Gestione DNS» / «Utility di dominio» → modifica record DNS.",
      "Aggiungi record CNAME per il sottodominio menu (o quello scelto).",
      "Campo Host: es. menu (Aruba concatena automaticamente .dominio.it).",
      `Campo Valore / Destinazione: target Firebase (es. ${PUBLIC_DOMAIN_CNAME_TARGET}). Non aggiungere il punto finale se Aruba lo gestisce da sola; se il pannello lo richiede, usa il formato con punto finale come negli altri CNAME esistenti.`,
      "Salva. Se compare un avviso su record in conflitto (CNAME vs A sullo stesso host), rimuovi o rinomina il record in conflitto solo su quel sottodominio.",
      "Torna a Firebase Hosting e attendi la verifica SSL.",
      "Opzionale: da Aruba «Redirect» non sostituisce il CNAME verso Firebase — per la webapp serve il record DNS, non un semplice redirect HTTP del pannello.",
    ],
    notes: [
      "Con hosting Aruba «gestito», DNS e sito possono essere sullo stesso pannello: non cancellare i record del sito marketing sulla root.",
      "Aruba DNS può richiedere fino a 24 ore; di solito è più veloce.",
      "Se usi Aruba Nameserver esterni (Cloudflare), configura i record lì, non nel pannello Aruba.",
    ],
    recordsExample: `Tipo: CNAME
Host: menu
Valore: ${PUBLIC_DOMAIN_CNAME_TARGET}`,
  },
  {
    id: "cloudflare",
    label: "Cloudflare",
    panelUrl: "https://dash.cloudflare.com/",
    steps: [
      "Accedi a Cloudflare → seleziona la zona del dominio → DNS → Records.",
      "Add record → Type CNAME.",
      "Name: menu (o ordina). Cloudflare mostra l’anteprima menu.tuodominio.it.",
      `Target: ${PUBLIC_DOMAIN_CNAME_TARGET} (o target Firebase).`,
      "Proxy status: per la prima verifica Firebase è più affidabile impostare DNS only (nuvola grigia). Dopo SSL attivo puoi valutare il proxy arancione.",
      "Save. Completa eventuali TXT di verifica richiesti da Firebase.",
      "In Firebase Hosting attendi Connected. Poi verifica https://menu.tuodominio.it in browser.",
    ],
    notes: [
      "Con proxy arancione, SSL Full (strict) lato Cloudflare evita loop o certificati misti.",
      "Non attivare Page Rules che reindirizzano tutto a un altro sito senza escludere il sottodominio menu.",
    ],
    recordsExample: `Type: CNAME
Name: menu
Target: ${PUBLIC_DOMAIN_CNAME_TARGET}
Proxy: DNS only (prima verifica)`,
  },
  {
    id: "ovh",
    label: "OVH / OVHcloud",
    panelUrl: "https://www.ovh.com/",
    steps: [
      "Area clienti OVH → Domini → nome dominio → Zona DNS.",
      "Aggiungi una voce CNAME.",
      "Sottodominio: menu (OVH completa con .dominio.tld).",
      `Target: ${PUBLIC_DOMAIN_CNAME_TARGET}. (spesso con punto finale: es. pizzamanager.it.)`,
      "Conferma e attendi la propagazione (TTL della zona).",
      "Aggiungi TXT di verifica Firebase se richiesto.",
      "Verifica in Firebase e apri l’URL HTTPS del menu.",
    ],
    notes: [
      "Se la zona DNS è esterna (es. Cloudflare), modifica i record lì.",
      "OVH «Redirezione» web ≠ record CNAME: per PizzaManager usa la Zona DNS.",
    ],
    recordsExample: `Campo: menu
Tipo: CNAME
Destinazione: ${PUBLIC_DOMAIN_CNAME_TARGET}.`,
  },
  {
    id: "godaddy",
    label: "GoDaddy",
    panelUrl: "https://www.godaddy.com/",
    steps: [
      "My Products → Domains → DNS / Manage DNS.",
      "Add → CNAME.",
      "Name: menu. Value: target Firebase / piattaforma.",
      "Save. Se GoDaddy usa «Domain Forwarding» sulla root, lascialo invariato e lavora solo sul sottodominio.",
      "Completa verifica Firebase (anche TXT se richiesto).",
    ],
    notes: [
      "Su alcuni piani GoDaddy il CNAME sull’apex (@) non è consentito: usa www o menu.",
    ],
    recordsExample: `Type: CNAME
Name: menu
Value: ${PUBLIC_DOMAIN_CNAME_TARGET}`,
  },
  {
    id: "namecheap",
    label: "Namecheap",
    panelUrl: "https://www.namecheap.com/",
    steps: [
      "Domain List → Manage → Advanced DNS.",
      "Add New Record → CNAME Record.",
      "Host: menu. Target: valore Firebase. TTL Automatic.",
      "Save All Changes. Attendi propagazione.",
      "Verifica Firebase Hosting + HTTPS.",
    ],
    notes: [
      "Se i nameserver non sono Namecheap BasicDNS, configura il record sul provider DNS effettivo.",
    ],
    recordsExample: `Type: CNAME Record
Host: menu
Value: ${PUBLIC_DOMAIN_CNAME_TARGET}`,
  },
  {
    id: "other",
    label: "Altro registrar (generico)",
    steps: [
      "Apri il pannello DNS del dominio (dove puntano i nameserver attivi).",
      "Crea un CNAME sul sottodominio scelto (menu / ordina / …).",
      "Valore = target mostrato da Firebase Hosting per quel dominio personalizzato.",
      "Aggiungi eventuali record TXT di ownership se Firebase li richiede.",
      "Non modificare i record del sito marketing sulla root se non è necessario.",
      "Attendi propagazione, verifica SSL in Firebase, segna «Dominio online» in Go-live.",
      "Aggiorna Redirect URL Auth per il nuovo hostname.",
    ],
    notes: [
      "Se non trovi «CNAME», cerca «record alias», «DNS records» o «zone file».",
      "In dubbio: sottodominio nuovo + CNAME è sempre il percorso più sicuro.",
      `Piattaforma di riferimento: ${PUBLIC_SAAS_BASE_URL} — stesso frontend, hostname diverso.`,
    ],
    recordsExample: `CNAME  menu  →  ${PUBLIC_DOMAIN_CNAME_TARGET}
(+ TXT di verifica se richiesto da Firebase)`,
  },
]

/**
 * Checklist operativa end-to-end per portare un tenant sul proprio dominio menu, senza deploy
 * Firebase dedicato (il codice è già quello della piattaforma) — stesso contenuto di
 * DNS_GENERIC_GUIDELINES.checklist ma in forma di procedura ordinata invece di elenco puntato:
 * questa è pensata come "segui i passi in ordine", quella come riferimento concettuale.
 */
export const DOMINIO_GO_LIVE_CHECKLIST = {
  title: "Go-live dominio reale — procedura passo passo",
  intro: "Segui i passi in ordine per portare un tenant dal sottodominio piattaforma al proprio dominio.",
  steps: [
    "In Go-live seleziona il tenant e verifica slug + anteprima https://{slug}.pizzamanager.it.",
    "Decidi l'hostname menu (es. menu.cliente.it oppure www se la root deve essere la webapp).",
    "Salva il dominio pubblico in piattaforma e imposta stato «DNS / Firebase in configurazione».",
    "Firebase Hosting → Aggiungi dominio personalizzato con lo stesso hostname.",
    "Nel registrar del cliente (Register, Aruba, …) applica la guida host corrispondente qui sotto (CNAME / A come da Firebase).",
    "Quando HTTPS è verde: apri / e /ordina sul dominio, controlla menu e branding.",
    "Supabase Auth → Redirect URLs per quel dominio (reimposta password).",
    "Stato pubblicazione → Dominio online.",
    "Se esiste un sito marketing separato: aggiorna i pulsanti «Ordina ora / Ordina online» verso https://<dominio-menu>/ordina (stesso dominio, non pizzamanager.it).",
  ],
}

export const EXTERNAL_SITE_CTA_GUIDELINES = {
  title: "Sito esterno del cliente — CTA Ordina",
  intro:
    "Se la pizzeria ha già un sito (WordPress, Wix, ecc.) diverso dal dominio menu, i pulsanti di ordine devono portare alla webapp sul dominio menu.",
  bullets: [
    "Link consigliato: https://<dominio-menu>/ordina (utente già sul brand del locale).",
    "Alternativa: https://<dominio-menu>/ (vetrina) con CTA interne all’app.",
    "Evitare di linkare https://pizzamanager.it/negozio?tenant=… in produzione sul sito del cliente (va bene solo per test SaaS).",
    "Campo «Sito web cliente» in Go-live è solo anagrafica/marketing: non risolve il tenant. Il tenant lo risolve il dominio menu.",
    "Dopo il go-live, verifica da mobile che Ordina apra HTTPS corretto e login/checkout funzionino sullo stesso host.",
  ],
}

export function getDnsHostGuide(id) {
  return DNS_HOST_GUIDES.find((g) => g.id === id) || DNS_HOST_GUIDES[DNS_HOST_GUIDES.length - 1]
}
