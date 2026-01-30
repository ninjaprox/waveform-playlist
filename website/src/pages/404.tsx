import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

export default function NotFound(): React.ReactElement {
  return (
    <Layout title="404 - Page Not Found" description="The page you are looking for does not exist">
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: '6rem',
            fontFamily: '"Courier New", monospace',
            color: 'var(--ifm-color-primary)',
            marginBottom: '0.5rem',
            textShadow: '0 0 20px rgba(99, 199, 95, 0.3)',
          }}
        >
          404
        </h1>
        <p
          style={{
            fontSize: '1.5rem',
            color: 'var(--ifm-color-emphasis-700)',
            marginBottom: '2rem',
            fontFamily: '"Courier New", monospace',
          }}
        >
          // signal not found
        </p>
        <p style={{ marginBottom: '2rem', maxWidth: '480px' }}>
          The page you are looking for has been moved, deleted, or never existed.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link
            to="/"
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              background: 'var(--ifm-color-primary)',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Home
          </Link>
          <Link
            to="/docs"
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              border: '1px solid var(--ifm-color-primary)',
              color: 'var(--ifm-color-primary)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Docs
          </Link>
          <Link
            to="/examples"
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              border: '1px solid var(--ifm-color-primary)',
              color: 'var(--ifm-color-primary)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Examples
          </Link>
        </div>
      </main>
    </Layout>
  );
}
