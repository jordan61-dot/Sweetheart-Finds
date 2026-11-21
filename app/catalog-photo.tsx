'use client';

import {useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import type {Product} from '../lib/domain';

export default function CatalogPhoto({image, alt}:{image:Product['images'][number]; alt:string}) {
  const [failed, setFailed] = useState(false);
  return <figure>
    {failed
      ? <p>Image unavailable from the source.</p>
      : <img src={image.url} alt={alt} onError={() => setFailed(true)}/>}
    <figcaption>{image.attribution}{' '}
      <a href={image.source} target="_blank" rel="noreferrer">
        {image.source.startsWith('https://openlibrary.org/books/') ? 'View this edition' : 'Source'} <ArrowUpRight size={10}/>
      </a>
    </figcaption>
  </figure>;
}
