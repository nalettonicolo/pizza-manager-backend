import axios from 'axios'

const baseURL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
    : ''

export const apiClient = axios.create({ baseURL })
