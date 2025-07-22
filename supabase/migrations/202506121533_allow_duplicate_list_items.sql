ALTER TABLE public.list_items
DROP CONSTRAINT IF EXISTS list_items_list_id_album_id_key;

ALTER TABLE public.list_items
DROP CONSTRAINT IF EXISTS list_items_list_id_artist_id_key;