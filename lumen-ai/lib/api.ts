const API_BASE = process.env.NEXT_PUBLIC_API_URL!

export async function createWorkflow(
  description: string,
  targetMinutes: number,
) {
  const res = await fetch(`${API_BASE}/workflows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description,
      target_minutes: targetMinutes,
    }),
  })
  if (!res.ok) throw new Error(`Failed to create workflow: ${res.status}`)
  return res.json()
}

export async function getWorkflow(id: string) {
  const res = await fetch(`${API_BASE}/workflows/${id}`)
  if (!res.ok) throw new Error(`Failed to get workflow: ${res.status}`)
  return res.json()
}
