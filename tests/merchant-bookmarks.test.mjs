import assert from 'node:assert/strict';
import test from 'node:test';
import {applyOperation,emptyPersonal,personalSchema} from '../lib/domain.ts';

test('merchant bookmarks survive feed disappearance, account serialization and both backup modes',()=>{
  const productId='wildmart-wm-123';
  const base=personalSchema.parse(emptyPersonal());
  const title='Hello Kitty collectible';
  let state=applyOperation(base,{id:'list',kind:'wishlist-create',listId:'one',name:'Gifts'});
  state=applyOperation(state,{id:'fav',kind:'favorite',productId,enabled:true,value:{title,price:100}});
  state=applyOperation(state,{id:'add',kind:'wishlist-item',listId:'one',productId,enabled:true,value:{title}});
  state=personalSchema.parse(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(state.merchantBookmarks[productId],{title});
  for(const kind of ['restore','restore-replace']){
    const restored=applyOperation(base,{id:'backup',kind,value:state});
    assert.deepEqual(restored.wishlists[0].products,[productId]);
    assert.deepEqual(restored.merchantBookmarks[productId],{title});
  }
  state=applyOperation(state,{id:'unfav',kind:'favorite',productId,enabled:false});
  assert.equal(state.merchantBookmarks[productId].title,title);
  state=applyOperation(state,{id:'remove',kind:'wishlist-item',listId:'one',productId,enabled:false});
  assert.equal(state.merchantBookmarks[productId],undefined);
});
