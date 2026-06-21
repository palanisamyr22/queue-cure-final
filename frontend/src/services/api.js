const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Helper to parse JSON responses and handle errors uniformly.
 */
async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  let data;
  try {
    data = await response.json();
  } catch (err) {
    data = null;
  }

  if (!response.ok) {
    const errorMsg = data?.detail || response.statusText;
    throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
  }

  return data;
}

export const api = {
  // Patients
  addPatient: (patientData) => 
    fetchApi('/api/patients/', { method: 'POST', body: JSON.stringify(patientData) }),
  
  listPatients: (status) => {
    const query = status ? `?status=${status}` : '';
    return fetchApi(`/api/patients/${query}`);
  },

  // Queue Operations
  callNext: () => fetchApi('/api/queue/call-next', { method: 'POST' }),
  
  completeConsultation: () => fetchApi('/api/queue/complete', { method: 'POST' }),
  
  markNoShow: () => fetchApi('/api/queue/no-show', { method: 'POST' }),
  
  cancelPatient: (patientId) => fetchApi(`/api/patients/${patientId}`, { method: 'DELETE' }),
  
  // Settings & Status
  getSettings: () => fetchApi('/api/queue/settings'),
  
  updateSettings: (settings) => fetchApi('/api/queue/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  }),

  getStatus: () => fetchApi('/api/queue/status'),
  
  getWaitTime: (tokenId) => fetchApi(`/api/queue/wait-time/${tokenId}`)
};
