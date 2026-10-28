import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="card" aria-labelledby="not-found-title">
      <h1 id="not-found-title">Page not found</h1>
      <p>The page you asked for does not exist.</p>
      <Link to="/">Back to home</Link>
    </section>
  )
}
