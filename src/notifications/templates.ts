/**
 * Un template par type d'evenement, comme prevu dans le cadrage (docs
 * montee-competence/21-notifications-service.md, §3.3). Du HTML simple pour
 * l'instant : la priorite est le flux de bout en bout, pas le design de
 * l'email.
 */
export function newsletterSubscriptionRequestedTemplate(confirmUrl: string): {
  subject: string;
  html: string;
} {
  return {
    subject: 'Confirme ton inscription à la newsletter Korea Beauty',
    html: `
      <p>Merci de vouloir rejoindre la newsletter Korea Beauty !</p>
      <p>Confirme ton adresse email pour recevoir nos nouveautés et offres :</p>
      <p><a href="${confirmUrl}">Confirmer mon inscription</a></p>
      <p>Ce lien expire dans 7 jours. Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.</p>
    `.trim(),
  };
}
