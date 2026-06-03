export default function CgvPage() {
    return (
        <div className="pt-32 pb-20 px-6 md:px-16 bg-gray-50 min-h-screen">
            <div className="max-w-4xl mx-auto">
                <p className="text-sm text-gray-500 mb-2">Dernière mise à jour : 25/11/2025</p>
                <h1 className="text-3xl md:text-5xl font-archivoBlack text-[#0C1D36] mb-4">
                    Conditions Générales de Vente
                </h1>
                <p className="text-gray-600 mb-12">
                    Les présentes Conditions Générales de Vente (ci-après « CGV ») régissent les modalités financières et commerciales applicables à l'abonnement, l'achat et l'utilisation de la plateforme Optigistik, éditée par Optigistik SAS, 2 Rue du Professeur Charles Appleton, 69007 Lyon.
                </p>

                <div className="space-y-10 text-gray-700">

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">1. Objet</h2>
                        <p className="mb-2">Les CGV définissent :</p>
                        <ul className="list-disc list-inside space-y-1 text-gray-600">
                            <li>les conditions financières liées à l'abonnement au logiciel</li>
                            <li>les modalités de facturation</li>
                            <li>les obligations réciproques entre Optigistik et le Client</li>
                            <li>les modalités de résiliation</li>
                        </ul>
                        <p className="mt-2">Elles complètent les CGU du logiciel.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">2. Offre et abonnements</h2>
                        <p className="mb-2">Optigistik propose plusieurs offres :</p>
                        <ul className="list-disc list-inside space-y-1 text-gray-600">
                            <li>offre mensuelle</li>
                            <li>offre annuelle</li>
                            <li>offre personnalisée sur devis</li>
                        </ul>
                        <p className="mt-2">Toutes les fonctionnalités proposées sont détaillées sur <a href="https://optigistik.com" className="text-[#FF453A] underline">optigistik.com</a> ou dans les documents commerciaux fournis.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">3. Prix</h2>
                        <p className="mb-2">Les prix applicables sont ceux indiqués :</p>
                        <ul className="list-disc list-inside space-y-1 text-gray-600">
                            <li>sur le site</li>
                            <li>dans les devis commerciaux</li>
                            <li>dans le contrat d'abonnement</li>
                        </ul>
                        <p className="mt-2">Les prix sont exprimés en euros, hors taxes. Optigistik se réserve le droit de modifier ses tarifs à tout moment, avec préavis de 30 jours.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">4. Facturation</h2>
                        <p>La facturation s'effectue mensuellement ou annuellement. La facture est envoyée par email et/ou dans l'espace client.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">5. Paiement</h2>
                        <p className="mb-2">Le paiement peut être réalisé via :</p>
                        <ul className="list-disc list-inside space-y-1 text-gray-600">
                            <li>prélèvement SEPA</li>
                            <li>virement bancaire</li>
                        </ul>
                        <p className="mt-2">Tout retard de paiement suspend l'accès à la plateforme sous 7 jours.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">6. Durée du contrat</h2>
                        <p>Le contrat est conclu pour 1 mois renouvelé automatiquement ou pour 12 mois renouvelables.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">7. Résiliation</h2>
                        <p>Le Client peut résilier à tout moment avec un préavis de 30 jours (formule mensuelle) ou 60 jours avant échéance (formule annuelle). Une résiliation ne donne lieu à aucun remboursement partiel.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">8. Evolutions tarifaires</h2>
                        <p>En cas de modification des prix notification par email entrée en vigueur à la prochaine échéance.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">9. Révision annuelle</h2>
                        <p>Optigistik peut appliquer une augmentation automatique annuelle maximale basée sur l'inflation de l'INSEE ou de 5% maximum.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">10. Engagements du Client</h2>
                        <p className="mb-2">Le Client s'engage à :</p>
                        <ul className="list-disc list-inside space-y-1 text-gray-600">
                            <li>communiquer des informations exactes</li>
                            <li>maintenir ses moyens de paiement à jour</li>
                            <li>ne pas frauder l'offre tarifaire</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">11. Exclusions de responsabilité</h2>
                        <p className="mb-2">Ne relèvent pas d'Optigistik :</p>
                        <ul className="list-disc list-inside space-y-1 text-gray-600">
                            <li>pertes de CA</li>
                            <li>pertes de données non sauvegardées</li>
                            <li>mauvaise utilisation du logiciel</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#0C1D36] mb-3">12. Loi applicable</h2>
                        <p>Les CGV sont soumises au droit français.</p>
                        <p className="mt-2"><span className="underline">Tribunal compétent :</span> Lyon</p>
                    </section>

                </div>

                <div className="mt-12 pt-8 border-t border-gray-200 space-y-6">
                    <div className="flex flex-wrap gap-3">
                        <a
                            href="/Conditions Générales.pdf"
                            download
                            className="inline-flex items-center gap-2 px-6 py-3 bg-[#0C1D36] text-white rounded-lg text-sm font-medium hover:bg-[#1a2e4d] transition"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                                <path d="M8 2v8m0 0l-3-3m3 3l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            Télécharger le document complet (PDF)
                        </a>
                        <a
                            href="/Conditions Générales.pdf"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 border border-[#0C1D36] text-[#0C1D36] rounded-lg text-sm font-medium hover:bg-[#0C1D36]/5 transition"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                                <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            Ouvrir dans un nouvel onglet
                        </a>
                    </div>

                    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gray-100">
                        <div className="px-4 py-2.5 bg-white border-b border-gray-200 flex items-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden className="text-[#FF453A]">
                                <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                                <path d="M4 5h6M4 7h4M4 9h5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                            </svg>
                            <span className="text-xs font-medium text-gray-500">Conditions Générales de Vente — Aperçu</span>
                        </div>
                        <iframe
                            src="/Conditions%20G%C3%A9n%C3%A9rales.pdf"
                            className="w-full h-[720px]"
                            title="Aperçu des Conditions Générales de Vente"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
