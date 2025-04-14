import { getFreshToken } from './auth';

export const fetchChildren = async () => {
  const token = await getFreshToken();
  const response = await fetch('http://<your_backend_url>/children/', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return await response.json();
};

export const createChild = async (name, dob) => {
  const token = await getFreshToken();
  const response = await fetch('http://<your_backend_url>/children/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, dob }),
  });
  return await response.json();
};
