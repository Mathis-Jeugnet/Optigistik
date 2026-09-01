import Link from "next/link";

export default function OperationalManagementBlock() {
    const features = [
        {
            title: 'Tournées',
            description: 'Création, planification et suivi des trajets et commandes.',
        },
        {
            title: 'Abonnements',
            description: 'Gestion rapide des commandes récurrentes de vos clients.',
        },
        {
            title: 'Véhicules & chauffeurs',
            description: 'Import automatique depuis l’ERP ou ajout manuel simple.',
        },
        {
            title: 'Clients',
            description: 'Centralisation des noms, adresses, contacts et facturation.',
        },
    ];

    return (
        <section className="w-full bg-white dark:bg-zinc-900 py-20 px-6 md:px-16 transition-colors duration-300">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                {/* LEFT CONTENT */}
                <div>
                    <h2 className="text-3xl md:text-4xl font-archivoBlack text-[#0C1D36] dark:text-white mb-12 text-center">
                        Gestion opérationnelle <br /> simplifiée
                    </h2>

                    <div className="space-y-8">
                        {features.map((feature, index) => (
                            <div key={index} className="flex flex-col items-center text-center">
                                <h3 className="text-lg md:text-xl font-bold text-[#0C1D36] dark:text-white mb-2">
                                    {feature.title}
                                </h3>
                                <p className="text-sm md:text-base text-gray-700 dark:text-gray-300">
                                    • {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT IMAGE */}
                <div className="flex justify-center lg:justify-end">
                    <img
                        src="/assets/logiciel.png"
                        alt="Gestion opérationnelle simplifiée"
                        className="w-full h-auto lg:max-w-none rounded-xl shadow-sm"
                    />
                </div>

            </div>
        </section>
    );
}
