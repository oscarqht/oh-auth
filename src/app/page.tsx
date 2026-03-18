import Link from 'next/link';

export default function Home() {
  const providers = [
    {
      id: 'google',
      name: 'Google',
      description: 'Start the Google OAuth2 flow using configured credentials.',
      docs: 'https://developers.google.com/identity/protocols/oauth2',
      image: '/img/provider-google.png',
    },
    {
      id: 'raindrop',
      name: 'Raindrop',
      description: 'Connect to Raindrop to capture and manage bookmarks.',
      docs: 'https://developer.raindrop.io/',
      image: '/img/provider-raindrop.png',
    },
    {
      id: 'unknown-provider',
      name: 'Provider not found',
      description:
        'Trigger the unsupported-provider card to verify fallback behavior.',
      docs: 'https://oauth.net/2/',
      image: '/img/provider-not-found-ghost.png',
    },
  ];

  return (
    <main className="min-h-screen bg-base-200 text-base-content">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
        <header className="text-center md:text-left">
          <p className="badge badge-primary mb-3">TailwindCSS + DaisyUI</p>
          <h1 className="text-3xl font-bold">OAuth2</h1>
          <p className="text-base-content/70">
            Start authentication flows for supported providers. Buttons redirect
            to live auth routes that will send you to each provider.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          {providers.map((provider) => (
            <div key={provider.id} className="card bg-base-100 shadow">
              {provider.image ? (
                <figure className="pt-6">
                  <img
                    src={provider.image}
                    alt={provider.name}
                    className="mx-auto h-80 w-80"
                  />
                </figure>
              ) : null}
              <div className="card-body">
                <h2 className="card-title">{provider.name}</h2>
                <p>{provider.description}</p>
                <div className="card-actions items-center justify-between">
                  <div className="flex gap-2">
                    <Link
                      className="btn btn-primary"
                      href={`/auth/${provider.id}`}
                    >
                      Start auth
                    </Link>
                    {provider.id === 'google' ? (
                      <Link
                        className="btn btn-secondary"
                        href="/auth/google?scope=https://www.googleapis.com/auth/calendar&show_token=true"
                      >
                        Test Calendar Scope
                      </Link>
                    ) : null}
                  </div>
                  <a
                    className="link link-secondary"
                    href={provider.docs}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Docs
                  </a>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
