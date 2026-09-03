export default function RealTimeTrackingBlock() {
    const features = [
        {
            title: 'Alertes',
            description: 'Notifications en cas de retard ou imprévu.',
        },
        {
            title: 'Tableau de bord',
            description: 'Vue claire des trajets et objectifs atteints.',
        },
        {
            title: 'Localisation',
            description: 'Géolocalisation instantanée de chaque véhicule.',
        },
        {
            title: 'Performances',
            description: 'Suivi vitesse, consommation et émissions.',
        },
    ];

    return (
        <section className="w-full bg-white dark:bg-zinc-900 py-20 px-6 md:px-16 transition-colors duration-300">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                {/* LEFT CONTENT */}
                <div>
                    <h2 className="text-3xl md:text-4xl font-archivoBlack text-[#0C1D36] dark:text-white mb-12 text-center">
                        Suivi en temps réel
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
                        src="/assets/truckview.png"
                        alt="Suivi en temps réel"
                        className="w-full h-auto lg:max-w-none rounded-xl shadow-sm"
                    />
                </div>

            </div>
        </section>
    );
}
