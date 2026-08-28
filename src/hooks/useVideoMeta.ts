import { useQuery } from "@tanstack/react-query";
import { fetchVideoOEmbed } from "@/lib/oembed";

/**
 * El título y el canal de un video, en cuanto se reconoce el link.
 *
 * La miniatura no necesita a nadie —su dirección se arma con el id— así que
 * aparece de inmediato; esto es lo que llega un instante después y termina de
 * contestar la única pregunta que importa cuando pegas un link: si es ese.
 *
 * Queda cacheado para siempre: el título de un video no cambia, y así pasar por
 * el mismo link dos veces no vuelve a preguntar.
 */
export function useVideoMeta(videoId: string | null) {
  const { data, isFetching } = useQuery({
    queryKey: ["video-meta", videoId],
    queryFn: () => fetchVideoOEmbed(videoId!),
    enabled: !!videoId,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  return {
    title: data?.title ?? null,
    author: data?.author ?? null,
    loading: !!videoId && isFetching && !data,
  };
}
