/** Curated low-light sample images for the gallery (CORS-enabled CDNs). */
export interface Sample {
  id: string;
  title: string;
  url: string;
  thumb: string;
}

export const SAMPLES: Sample[] = [
  {
    id: "city-night",
    title: "City Night",
    url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1600&q=80&auto=format&fit=crop",
    thumb: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&q=70&auto=format&fit=crop",
  },
  {
    id: "alley-lamp",
    title: "Lamp-lit Alley",
    url: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1600&q=80&auto=format&fit=crop",
    thumb: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=400&q=70&auto=format&fit=crop",
  },
  {
    id: "dim-room",
    title: "Dim Interior",
    url: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1600&q=80&auto=format&fit=crop",
    thumb: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=400&q=70&auto=format&fit=crop",
  },
  {
    id: "forest-dusk",
    title: "Forest at Dusk",
    url: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1600&q=80&auto=format&fit=crop",
    thumb: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=70&auto=format&fit=crop",
  },
  {
    id: "portrait-low",
    title: "Low-Light Portrait",
    url: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=1600&q=80&auto=format&fit=crop",
    thumb: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=70&auto=format&fit=crop",
  },
  {
    id: "rain-street",
    title: "Rainy Street",
    url: "https://images.unsplash.com/photo-1493514789931-586cb221d7a7?w=1600&q=80&auto=format&fit=crop",
    thumb: "https://images.unsplash.com/photo-1493514789931-586cb221d7a7?w=400&q=70&auto=format&fit=crop",
  },
];
