'use client';

import { useState } from 'react';
import { sendContactEmail } from '../actions';

export default function ContactBlock() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const formData = new FormData(event.currentTarget);
        const result = await sendContactEmail(formData);

        setIsSubmitting(false);

        if (result.success) {
            setIsSuccess(true);
        } else {
            setError(result.error || 'Une erreur est survenue.');
        }
    }

    if (isSuccess) {
        return (
            <section className="w-full py-20 px-4 bg-[#eef1f5] flex flex-col items-center justify-center min-h-[600px]">
                <div className="text-center max-w-2xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-[#0f172a] mb-6">
                        Votre message a bien été envoyé !
                    </h2>
                    <p className="text-gray-600 mb-12">
                        Notre équipe le traitera dans les meilleurs délais.
                    </p>
                    <div className="flex justify-center">
                        <div className="flex items-center gap-2">
                            <img
                                src="/assets/LogoOpitigistik2RMBG.png"
                                alt="Optigistik Logo"
                                className="h-36 w-auto"
                            />
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="w-full bg-white dark:bg-zinc-900 pt-32 pb-20 px-6 md:px-16 transition-colors duration-300">
            <div className="max-w-7xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-archivoBlack text-center text-[#0C1D36] dark:text-white mb-12">
                    Une demande ? Contactez-nous !
                </h2>

                <div className="flex flex-col md:flex-row justify-between items-center bg-[#E5E8EC] dark:bg-zinc-800 rounded-xl px-8 py-5 mb-12 gap-4 text-center md:text-left text-sm text-gray-700 dark:text-gray-300 transition-colors duration-300">
                    <div>+33 4 87 54 34 61</div>
                    <div>2 Rue du Professeur Charles Appleton, 69007 Lyon</div>
                    <div>optigistik@gmail.com</div>
                </div>

                <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-12 max-w-4xl mx-auto">
                    Notre équipe est à votre disposition pour répondre à vos questions, vous accompagner dans vos projets et vous présenter OPTIGISTIK plus en détail.
                </p>

                <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
                    <div className="space-y-2">
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Nom *
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            required
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-[#F5F7FA] dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-[#FF453A] focus:outline-none transition-shadow"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="siret" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            SIRET de l'entreprise *
                        </label>
                        <input
                            type="text"
                            id="siret"
                            name="siret"
                            required
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-[#F5F7FA] dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-[#FF453A] focus:outline-none transition-shadow"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Mail *
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            required
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-[#F5F7FA] dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-[#FF453A] focus:outline-none transition-shadow"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Message *
                        </label>
                        <textarea
                            id="message"
                            name="message"
                            required
                            rows={6}
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-[#F5F7FA] dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-[#FF453A] focus:outline-none transition-shadow resize-none"
                        ></textarea>
                    </div>

                    {error && (
                        <div className="text-red-600 text-center text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-center pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-8 py-3 bg-[#FF453A] hover:bg-[#e63d32] text-white font-medium rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Envoi en cours...' : 'Envoyer le message'}
                        </button>
                    </div>
                </form>
            </div>
        </section>
    );
}
