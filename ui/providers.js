(() => {
  let hooks;let state;
  const text=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node;};
  const button=(label,action,disabled=false)=>{const node=text('button',label);node.type='button';node.className='secondary-button';node.disabled=disabled;node.addEventListener('click',action);return node;};
  globalThis.kairosProviders={
    init(callbacks){hooks=callbacks;},
    preset(id){return state?.providerCatalog.find(p=>p.id===id);},
    render(next){
      state=next;if(!hooks)return;
      const locked=next.busy||next.settingsBusy||next.jobAction;
      document.querySelector('#provider-catalog').replaceChildren(...(next.providerCatalog??[]).map(item=>{
        const article=document.createElement('article');article.className='provider-offer';
        article.append(text('h3',item.name),text('p',item.offer),text('p',item.registration),text('p',item.conditions),text('small','Prüfdatum: '+item.checkedAt+' · Kreditkarte: '+item.cardRequirement+' · Region: '+item.region),text('p',item.quota));
        const actions=document.createElement('div');actions.className='server-actions';
        actions.append(button('Eigenen Schlüssel erstellen',()=>void hooks.openLink(item.keysUrl)),button('Bedingungen und Limits',()=>void hooks.openLink(item.docsUrl)),button('Datenschutz',()=>void hooks.openLink(item.privacyUrl)),button('Einrichten',()=>hooks.setup(item.id),locked));
        article.append(actions);
        const profiles=next.settings.profiles.filter(p=>p.provider===item.id);
        if(!profiles.length) article.append(text('p','Angebot laut Katalog · noch kein eigener Zugang eingerichtet.'));
        else {
          // One key check per connection, not one per imported model.
          const connections=new Map();for(const p of profiles) if(!connections.has(p.authRef)||p.id===next.settings.activeId||next.providerQuota?.[p.id])connections.set(p.authRef,p);
          for(const p of connections.values()){
            const quota=next.providerQuota?.[p.id];const status=next.profileHealth?.[p.id];
            article.append(text('p',p.name+' · '+(status?.message??'Modell noch nicht geprüft')));
            article.append(text('p',quota?.message??'Kontingent unbekannt; noch keine Zugangsauskunft geladen.'));
            if(quota){
              const values=[];
              if(quota.creditRemaining!=null)values.push('Schlüssellimit verbleibend: '+quota.creditRemaining+' USD');
              if(quota.creditLimit!=null)values.push('Schlüssellimit: '+quota.creditLimit+' USD');
              if(quota.freeDailyLimit!=null)values.push('Tageslimit kostenloser Anfragen (UTC): '+quota.freeDailyLimit);
              if(quota.freeDailyUsed!=null)values.push('Heute laut Anbieter genutzt: '+quota.freeDailyUsed);
              if(quota.freeDailyRemaining!=null)values.push('Heute laut Anbieter verbleibend: '+quota.freeDailyRemaining+' (Gültigkeit abhängig von Konto und Anfrageart)');
              if(quota.requestsRemaining!=null)values.push('Anfragen pro Tag verbleibend laut Header: '+quota.requestsRemaining);
              if(quota.tokensRemaining!=null)values.push('Tokens pro Minute verbleibend laut Header: '+quota.tokensRemaining);
              if(quota.checkedAt)values.push('Auskunft: '+new Date(quota.checkedAt).toLocaleString('de-DE'));
              article.append(text('p',values.join(' · ')));
            }
            article.append(button(item.id==='openrouter'?'Eigenen Zugang prüfen':'Limits im Dashboard öffnen',()=>item.id==='openrouter'?hooks.checkQuota(p.id):void hooks.openLink(item.dashboardUrl),locked));
          }
        }
        return article;
      }));
    },
  };
})();
