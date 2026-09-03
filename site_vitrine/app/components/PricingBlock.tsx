import React from 'react';

export default function PricingBlock() {
    return (
        <section className="w-full bg-[#E5E8EC] dark:bg-zinc-800 pt-32 pb-20 px-6 md:px-16 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4">
                <div className="text-center mb-16">
                    <h3 className="text-xs md:text-sm tracking-[0.2em] font-semibold text-[#0C1D36] dark:text-gray-300 uppercase mb-4">
                        Nos offres
                    </h3>
                    <h2 className="text-3xl md:text-4xl font-archivoBlack text-[#0C1D36] dark:text-white mb-6">
                        Une solution adaptée à chaque besoin
                    </h2>
                    <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
                        Que vous soyez une petite entreprise de transport ou un grand groupe logistique, OPTIGISTIK propose des formules adaptées à votre taille et à vos objectifs.
                    </p>
                </div>

                <div className="flex flex-col gap-8 max-w-2xl mx-auto">
                    {/* Pay per use Card */}
                    <div className="bg-white dark:bg-zinc-700 rounded-[2rem] p-8 md:p-12 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-all duration-300">
                        <h3 className="text-2xl md:text-3xl font-archivoBlack text-[#0C1D36] dark:text-white mb-4">Pay per use</h3>
                        <p className="text-gray-700 dark:text-gray-200 text-sm md:text-base font-medium mb-8 min-h-[48px] flex items-center">
                            Payez uniquement pour les camions que vous utilisez. Accès à l'intégralité du logiciel.
                        </p>
                        <div className="text-4xl md:text-6xl font-archivoBlack text-[#0C1D36] dark:text-white mb-4">
                            80€
                        </div>
                        <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mb-6">par camion / mois</p>
                        <div className="w-full border-t border-gray-200 dark:border-zinc-600 pt-6 mb-8 space-y-3">
                            <div className="flex justify-between items-center text-sm md:text-base">
                                <span className="text-gray-700 dark:text-gray-200">Installation seule</span>
                                <span className="font-archivoBlack text-[#0C1D36] dark:text-white">4 500€</span>
                            </div>
                            <div className="flex justify-between items-center text-sm md:text-base">
                                <span className="text-gray-700 dark:text-gray-200">Avec intégration ERP</span>
                                <span className="font-archivoBlack text-[#0C1D36] dark:text-white">6 500€</span>
                            </div>
                        </div>
                        <button className="mt-auto px-8 py-3 bg-[#FF453A] hover:bg-[#e63d32] text-white font-medium rounded-lg transition-colors">
                            Démarrer
                        </button>
                    </div>

                    {/* Sur devis Card */}
                    <div className="bg-white dark:bg-zinc-700 rounded-[2rem] p-8 md:p-12 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-all duration-300">
                        <h3 className="text-2xl md:text-3xl font-archivoBlack text-[#0C1D36] dark:text-white mb-4">+1 000 camions</h3>
                        <p className="text-gray-700 dark:text-gray-200 text-sm md:text-base font-medium mb-8 min-h-[48px] flex items-center">
                            Vous gérez une grande flotte ? Nous construisons une offre sur mesure adaptée à vos volumes et à vos contraintes.
                        </p>
                        <div className="text-4xl md:text-6xl font-archivoBlack text-[#0C1D36] dark:text-white mb-4">
                            Sur devis
                        </div>
                        <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mb-6">Réponse sous 48h ouvrées</p>
                        <div className="w-full border-t border-gray-200 dark:border-zinc-600 pt-6 mb-8">
                            <p className="text-sm md:text-base text-gray-700 dark:text-gray-200">
                                Remplissez le formulaire ci-dessous pour recevoir une proposition personnalisée.
                            </p>
                        </div>
                        <a
                            href="#devis"
                            className="mt-auto px-8 py-3 bg-[#FF453A] hover:bg-[#e63d32] text-white font-medium rounded-lg transition-colors"
                        >
                            Demander un devis
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}
