import { Album, Asset } from 'expo-media-library';
import { useCallback, useRef } from 'react';

const ALBUM_NAME = 'Halo';

export type SaveResult =
  | { ok: true; uri: string | null }
  | { ok: false; reason: string };

/**
 * Saves a capture to the camera roll and files it under a "Halo" album.
 *
 * SDK 57 removed the runtime implementation of the old functional API
 * (`createAssetAsync`, `getAlbumAsync`, …) from the package root — those
 * exports now throw — so this uses the current `Asset`/`Album` classes.
 */
export function useMediaSaver(): {
  save: (localUri: string) => Promise<SaveResult>;
} {
  /** Looked up once; album lookups are a round trip we do not need to repeat. */
  const albumRef = useRef<Album | null>(null);

  const save = useCallback(async (localUri: string): Promise<SaveResult> => {
    try {
      const asset = await Asset.create(localUri);

      try {
        if (!albumRef.current) {
          albumRef.current = await Album.get(ALBUM_NAME);
        }
        if (albumRef.current) {
          await albumRef.current.add(asset);
        } else {
          // `create` files the asset as part of creating the album, so there is
          // no follow-up `add` here — doing both would duplicate it on Android.
          albumRef.current = await Album.create(ALBUM_NAME, [asset], false);
        }
      } catch {
        // Album filing is a nicety. The shot is already in the camera roll,
        // which is the part the user actually asked for.
      }

      let uri: string | null = null;
      try {
        uri = await asset.getUri();
      } catch {
        /* Thumbnail is optional. */
      }

      return { ok: true, uri };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : 'Could not save to your library.',
      };
    }
  }, []);

  return { save };
}
