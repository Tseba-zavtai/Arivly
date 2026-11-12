import { useQuery } from '@tanstack/react-query';
import { readHomePage } from '@/lib/homePageStore';
import { DEFAULT_HOME_PAGE } from '@/lib/homePageContent';

export default function usePublishedHomePage(enabled = true) {
  const query = useQuery({ queryKey: ['published-web-home'], queryFn: () => readHomePage('published'), staleTime: 30000, retry: false, enabled });
  return query.data?.content ?? DEFAULT_HOME_PAGE;
}
