import confirmSignupHtml from "../../../../supabase/templates/auth/confirm_signup.html?raw"
import resetPasswordHtml from "../../../../supabase/templates/auth/reset_password.html?raw"
import magicLinkHtml from "../../../../supabase/templates/auth/magic_link.html?raw"
import changeEmailHtml from "../../../../supabase/templates/auth/change_email.html?raw"
import inviteHtml from "../../../../supabase/templates/auth/invite.html?raw"

/**
 * Template Auth Supabase (repo). Allineati a supabase/config.toml e npm run supabase:auth:email-templates.
 * Variabili Go template: {{ .ConfirmationURL }}, {{ .Email }}, {{ .SiteURL }}, ecc.
 *
 * {{ if .Data.tenant_nome }}...{{ end }}: instrada il lettore giusto. Un cliente registrato su una
 * vetrina tenant ha `tenant_nome` nei suoi metadata utente (impostato da signUpCliente in
 * clienteAuthService.js) e vede "contatta direttamente il locale" per problemi legati al suo
 * ordine — non deve scrivere al supporto della piattaforma, che non può aiutarlo con un ordine.
 * Uno staff creato da Admin/Superadmin non ha questo dato: vede solo l'assistenza tecnica
 * dell'app. Limite noto: Supabase non supporta email per-tenant, quindi il messaggio "assistenza
 * tecnica" resta uguale per tutti — solo la parte "contatta il locale" è condizionale.
 */
export const AUTH_EMAIL_TEMPLATES = [
  {
    id: "confirmation",
    label: "Conferma registrazione",
    subject: "Conferma il tuo account PizzaManager",
    supabaseSubjectKey: "mailer_subjects_confirmation",
    supabaseContentKey: "mailer_templates_confirmation_content",
    file: "supabase/templates/auth/confirm_signup.html",
    html: confirmSignupHtml,
    variables: ["{{ .ConfirmationURL }}", "{{ .Email }}", "{{ .SiteURL }}", "{{ if .Data.tenant_nome }}...{{ end }}"],
  },
  {
    id: "recovery",
    label: "Reimposta password",
    subject: "Reimposta la password del tuo account",
    supabaseSubjectKey: "mailer_subjects_recovery",
    supabaseContentKey: "mailer_templates_recovery_content",
    file: "supabase/templates/auth/reset_password.html",
    html: resetPasswordHtml,
    variables: ["{{ .ConfirmationURL }}", "{{ .Email }}", "{{ .SiteURL }}", "{{ if .Data.tenant_nome }}...{{ end }}"],
  },
  {
    id: "magic_link",
    label: "Magic link / accesso rapido",
    subject: "Link di accesso rapido PizzaManager",
    supabaseSubjectKey: "mailer_subjects_magic_link",
    supabaseContentKey: "mailer_templates_magic_link_content",
    file: "supabase/templates/auth/magic_link.html",
    html: magicLinkHtml,
    variables: ["{{ .ConfirmationURL }}", "{{ .Email }}", "{{ .SiteURL }}", "{{ if .Data.tenant_nome }}...{{ end }}"],
  },
  {
    id: "email_change",
    label: "Cambio email",
    subject: "Conferma cambio email account",
    supabaseSubjectKey: "mailer_subjects_email_change",
    supabaseContentKey: "mailer_templates_email_change_content",
    file: "supabase/templates/auth/change_email.html",
    html: changeEmailHtml,
    variables: ["{{ .ConfirmationURL }}", "{{ .Email }}", "{{ .NewEmail }}", "{{ .SiteURL }}", "{{ if .Data.tenant_nome }}...{{ end }}"],
  },
  {
    id: "invite",
    label: "Invito utente",
    subject: "Invito account PizzaManager",
    supabaseSubjectKey: "mailer_subjects_invite",
    supabaseContentKey: "mailer_templates_invite_content",
    file: "supabase/templates/auth/invite.html",
    html: inviteHtml,
    variables: ["{{ .ConfirmationURL }}", "{{ .Email }}", "{{ .SiteURL }}", "{{ if .Data.tenant_nome }}...{{ end }}"],
  },
]
