export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    try {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        new URL(`https://${url}`);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }
};

export const formatUrl = (url) => {
  if (!url) return '';

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  return `https://${url}`;
};
