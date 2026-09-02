export default function ConfidentialitePage() {
    return (
        <div className="pt-32 pb-20 px-6 md:px-16 bg-gray-50 min-h-screen">
            <div className="max-w-4xl mx-auto">
                <p className="text-sm text-gray-500 mb-2">Dernière mise à jour : 30/10/2025</p>
                <h1 className="text-3xl md:text-5xl font-archivoBlack text-[#0C1D36] mb-4">
                    Politique de Confidentialité
                </h1>
                <p className="text-gray-600 mb-12">
                    La présente Politique de Confidentialité explique comment Optigistik collecte, utilise, protège et traite les données personnelles des utilisateurs conformément au RGPD et à la loi française.
                </p>

                <div className="space-y-10 text-gray-700">

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">1. Responsable du traitement</h2>
                        <p><strong>Optigistik SAS</strong></p>
                        <p>Adresse : 2 Rue du Professeur Charles Appleton, 69007 Lyon</p>
                        <p>Email : <a href="mailto:optigistik@gmail.com" className="text-[#FF453A] underline">optigistik@gmail.com</a></p>
                        <p>Représentant légal : Chan Tien Alexandre</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">2. Données collectées</h2>
                        <p className="mb-3 font-medium">Données fournies par l'utilisateur :</p>
                        <ul className="list-disc list-inside space-y-1 text-gray-600 mb-4">
                            <li>Nom & prénom</li>
                            <li>Email</li>
                            <li>Numéro de téléphone</li>
                            <li>Nom de l'entreprise</li>
                            <li>Fonction / rôle</li>
                            <li>Message transmis via nos formulaires</li>
                        </ul>
                        <p className="mb-3 font-medium">Données collectées automatiquement :</p>
                        <ul className="list-disc list-inside space-y-1 text-gray-600">
                            <li>Adresse IP</li>
                            <li>Données de navigation (pages vues, temps de visite…)</li>
                            <li>Cookies techniques et analytiques</li>
                            <li>Informations appareil / navigateur</li>
                        </ul>
                        <p className="mt-3 text-sm text-gray-500">Nous ne collectons aucune donnée sensible.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">3. Finalités de la collecte</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                                <thead className="bg-[#0C1D36] text-white">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Finalité</th>
                                        <th className="px-4 py-3 text-left">Exemple</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    <tr className="bg-white"><td className="px-4 py-3">Réponse aux demandes & démos</td><td className="px-4 py-3">Formulaire de contact</td></tr>
                                    <tr className="bg-gray-50"><td className="px-4 py-3">Suivi commercial</td><td className="px-4 py-3">Emails d'information</td></tr>
                                    <tr className="bg-white"><td className="px-4 py-3">Amélioration du site</td><td className="px-4 py-3">Analyse du trafic</td></tr>
                                    <tr className="bg-gray-50"><td className="px-4 py-3">Sécurité & prévention fraude</td><td className="px-4 py-3">Logs serveurs</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-3 text-sm text-gray-500">Nous ne revendons jamais les données personnelles.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">4. Base légale du traitement</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                                <thead className="bg-[#0C1D36] text-white">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Base légale</th>
                                        <th className="px-4 py-3 text-left">Cas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    <tr className="bg-white"><td className="px-4 py-3">Consentement</td><td className="px-4 py-3">Formulaires, cookies</td></tr>
                                    <tr className="bg-gray-50"><td className="px-4 py-3">Intérêt légitime</td><td className="px-4 py-3">Analyse du site, sécurité</td></tr>
                                    <tr className="bg-white"><td className="px-4 py-3">Exécution pré-contractuelle</td><td className="px-4 py-3">Demande de rendez-vous / démo</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">5. Durée de conservation</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                                <thead className="bg-[#0C1D36] text-white">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Données</th>
                                        <th className="px-4 py-3 text-left">Durée</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    <tr className="bg-white"><td className="px-4 py-3">Demandes de contact</td><td className="px-4 py-3">24 mois</td></tr>
                                    <tr className="bg-gray-50"><td className="px-4 py-3">Logs techniques</td><td className="px-4 py-3">12 mois</td></tr>
                                    <tr className="bg-white"><td className="px-4 py-3">Cookies analytiques</td><td className="px-4 py-3">13 mois maximum</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">6. Hébergement & sécurité</h2>
                        <p className="mb-2">Les données sont hébergées en Europe par des prestataires conformes RGPD. Mesures de sécurité :</p>
                        <ul className="list-disc list-inside space-y-1 text-gray-600">
                            <li>Serveurs sécurisés (HTTPS, firewall, anti-DDoS)</li>
                            <li>Accès restreint aux données</li>
                            <li>Journalisation des accès</li>
                            <li>Sauvegardes régulières</li>
                        </ul>
                        <p className="mt-2">Aucune donnée n'est transférée en dehors de l'Union Européenne sans garanties adéquates.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">7. Partage avec des tiers</h2>
                        <p className="mb-2">Les données peuvent être partagées uniquement avec des prestataires techniques indispensables :</p>
                        <ul className="list-disc list-inside space-y-1 text-gray-600">
                            <li>Hébergeur web (Infomaniak)</li>
                            <li>Solution email (Hunter)</li>
                            <li>Outils analytiques (Google Analytics)</li>
                            <li>CRM (HubSpot)</li>
                        </ul>
                        <p className="mt-2">Tous nos prestataires sont conformes à la RGPD. Aucun partage commercial ou revente des données.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">8. Vos droits</h2>
                        <p className="mb-2">Conformément à la RGPD, vous disposez des droits suivants :</p>
                        <ul className="list-disc list-inside space-y-1 text-gray-600">
                            <li>Droit d'accès</li>
                            <li>Droit de rectification</li>
                            <li>Droit d'effacement</li>
                            <li>Droit de limitation du traitement</li>
                            <li>Droit d'opposition</li>
                            <li>Droit à la portabilité</li>
                            <li>Droit de retirer son consentement</li>
                        </ul>
                        <p className="mt-3">Pour exercer vos droits : <a href="mailto:optigistik@gmail.com" className="text-[#FF453A] underline">optigistik@gmail.com</a> — Réponse sous 30 jours maximum.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">9. Modification de la politique</h2>
                        <p>Optigistik peut modifier cette politique à tout moment. La version en ligne la plus récente fait foi.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">10. Contact</h2>
                        <p>Mail : <a href="mailto:optigistik@gmail.com" className="text-[#FF453A] underline">optigistik@gmail.com</a></p>
                        <p>Adresse : 2 Rue du Professeur Charles Appleton, 69007 Lyon</p>
                    </section>

                </div>
            </div>
        </div>
    );
}
