import '../styles/globals.css'
import Head from 'next/head'
export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>台股強勢股雷達</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
