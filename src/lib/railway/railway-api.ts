/**
 * Railway API client — used to restart the Evolution API container
 * when the webhook dispatch process breaks after a Railway restart.
 *
 * Requires env var:
 *   RAILWAY_API_TOKEN — personal Railway API token (generate at railway.com/account/tokens)
 *
 * Service IDs are fixed for this project and fall back to hard-coded values
 * so they work even if the env vars aren't set explicitly.
 */

const RAILWAY_GQL = 'https://backboard.railway.app/graphql/v2'

const EVOLUTION_SERVICE_ID =
  process.env.RAILWAY_EVOLUTION_SERVICE_ID || '500fbfdd-3176-4a90-bfb5-2472d52fc623'

const EVOLUTION_ENVIRONMENT_ID =
  process.env.RAILWAY_EVOLUTION_ENVIRONMENT_ID || 'b8782584-a3bc-4838-928d-1a336b9c5592'

async function railwayGql<T>(
  token: string,
  query: string,
  variables: Record<string, string>
): Promise<{ data?: T; errors?: { message: string }[] }> {
  const response = await fetch(RAILWAY_GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  return response.json()
}

/**
 * Restarts the active deployment of the Evolution API service on Railway.
 * Uses serviceInstanceRedeploy which triggers a fresh container start
 * without pulling a new image — same as clicking "Restart" in the Railway UI.
 */
export async function restartEvolutionApi(): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) return { ok: false, error: 'RAILWAY_API_TOKEN not configured' }

  try {
    // First try serviceInstanceRedeploy (restarts without new image pull)
    const result = await railwayGql<{ serviceInstanceRedeploy: boolean }>(
      token,
      `mutation Restart($serviceId: String!, $environmentId: String!) {
         serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
       }`,
      { serviceId: EVOLUTION_SERVICE_ID, environmentId: EVOLUTION_ENVIRONMENT_ID }
    )

    if (result.errors?.length) {
      return { ok: false, error: result.errors[0].message }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

/**
 * Returns info about the active Evolution API deployment.
 * Used for logging/diagnostics.
 */
export async function getEvolutionDeploymentInfo(): Promise<{
  deploymentId?: string
  status?: string
  error?: string
}> {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) return { error: 'RAILWAY_API_TOKEN not configured' }

  try {
    const result = await railwayGql<{
      deployments: { edges: { node: { id: string; status: string } }[] }
    }>(
      token,
      `query Deployments($serviceId: String!, $environmentId: String!) {
         deployments(input: { serviceId: $serviceId, environmentId: $environmentId }) {
           edges { node { id status } }
         }
       }`,
      { serviceId: EVOLUTION_SERVICE_ID, environmentId: EVOLUTION_ENVIRONMENT_ID }
    )

    if (result.errors?.length) return { error: result.errors[0].message }

    const active = result.data?.deployments.edges.find(
      (e) => e.node.status === 'SUCCESS' || e.node.status === 'DEPLOYING'
    )
    return {
      deploymentId: active?.node.id,
      status: active?.node.status,
    }
  } catch (err) {
    return { error: String(err) }
  }
}
