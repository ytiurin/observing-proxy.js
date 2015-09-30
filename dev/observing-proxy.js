/*
 * Observing proxy
 * https://github.com/ytiurin/observingproxy
 *
 * The MIT License (MIT)
 * https://github.com/ytiurin/observingproxy/blob/master/LICENSE
 *
 * September 30, 2015
 */

'use strict';

!function(){

var tl=function(i,ln,ms){
  return function(ms,f){
    i++;
    if(f()) ln='info',ms='Test '+i+' passed: '+ms;
    else ln='error',ms='Test '+i+' failed: '+ms;
    console[ln](ms)}}(0);
var cl=function(){
  console.log.apply(console,arguments)};

var observingProxy=function(targetStack,proxyStack,changeStack,handlerStack,timeoutStack){

  function getDeepPropertyDescriptors(o)
  {
    var ns;

    if(o){
      ns=getDeepPropertyDescriptors(Object.getPrototypeOf(o))||[];
      Array.prototype.push.apply(ns,
        Object.getOwnPropertyNames(o)
          .filter(function(k){
            return isNaN(parseInt(k))})
          .map(function(k){
            return {name:k,descriptor:Object.getOwnPropertyDescriptor(o,k)}}));
    }

    return ns;
  }

  function newProxy(t)
  {
    var p={},ns=getDeepPropertyDescriptors(t);

    for(var i=ns.length;i--;){
      delete ns[i].descriptor.value;
      delete ns[i].descriptor.writable;

      ns[i].descriptor.get=propertyGetter.bind({target:t,name:ns[i].name});
      ns[i].descriptor.set=propertySetter.bind({target:t,name:ns[i].name});

      try{
        Object.defineProperty(p,ns[i].name,ns[i].descriptor);
      }
      catch(e){}
    }

    return p;
  }

  function notifyObservers(target)
  {
    var i=targetIndex(target);

    for(var l=0;l<handlerStack[i].length;l++)
      handlerStack[i][l].call(this,changeStack[i]);

    changeStack[i]=[];
  }

  function propertyGetter()
  {
    var r=this.target[this.name];

    if(Array.isArray(this.target)&&['pop','push','shift','splice','unshift'].
      indexOf(this.name)>-1)
      r=function(){
        var res=this.target[this.name].apply(this.target,arguments),
          targetInd=targetIndex(this.target);

        changeStack[targetInd].push(({
          'pop':{object:this.target,type:'splice',index:this.target.length-1,
            removed:[res],addedCount:0},
          'push':{object:this.target,type:'splice',index:this.target.length-1,
            removed:[],addedCount:1},
          'shift':{object:this.target,type:'splice',index:0,removed:[res],
            addedCount:0},
          'splice':{object:this.target,type:'splice',index:arguments[0],
            removed:res,addedCount:Array.prototype.slice.call(arguments,2).length},
          'unshift':{object:this.target,type:'splice',index:0,removed:[],
            addedCount:1}
        })[this.name]);

        clearTimeout(timeoutStack[targetInd]);
        timeoutStack[targetInd]=setTimeout(function(){
          notifyObservers(this.target)}.bind(this));
      }.bind(this);

    return r;
  }

  function propertySetter(userVal)
  {
    var val=this.target[this.name],
      targetInd=targetIndex(this.target);

    if(val!==userVal){
      this.target[this.name]=userVal;
      changeStack[targetInd].push(
        {name:this.name,object:this.target,type:'update',oldValue:val});
      clearTimeout(timeoutStack[targetInd]);
      timeoutStack[targetInd]=setTimeout(function(){
        notifyObservers(this.target)}.bind(this));
    }
  }

  function targetIndex(t)
  {
    var i=targetStack.indexOf(t);

    if(i===-1){
      i=targetStack.push(t)-1;
      proxyStack.push(newProxy(t));
      changeStack.push([]);
      handlerStack.push([]);
      timeoutStack.push(0);
    }

    return i;
  }

  function validateTarget(target)
  {
    if(!target)
      throw 'Observing proxy error: invalid target';
  }

  if(this.test_o)
    tl('getDeepPropertyDescriptors',function(){
      return getDeepPropertyDescriptors([1,2,3]).length===42});

  if(this.test_o)
    tl('Property getter',function(){
      var s={p1:1};
      return newProxy(s).p1===s.p1});

  if(this.test_o)
    tl('Property setter',function(){
      var s={p1:1};
      newProxy(s).p1=2;
      return s.p1===2});

  if(this.test_o)
    tl('Array splice',function(){
      var s=[];
      newProxy(s).push(1);
      return s.length===1});

  return {
    addChangeHandler:function(target,changeHandler,callOnInit){
      validateTarget(target);

      var targetInd=targetIndex(target);
      handlerStack[targetInd].indexOf(changeHandler)===-1&&
      handlerStack[targetInd].push(changeHandler);

      if(callOnInit){
        var changes=Object.getOwnPropertyNames(target).map(function(key){
          return {name:key,object:target,type:'update',oldValue:target[key]}
        });
        clearTimeout(timeoutStack[targetInd]);
        timeoutStack[targetInd]=setTimeout(function(){
          changeHandler.call(target,changes)});
      }
    },
    addPropertyHandler:function(target,propertyName,changeHandler,callOnInit){
      var onPropertyChange;

      this.addChangeHandler(target,onPropertyChange=function(changes){
        for(var i=changes.length;i--;)
          if(changes[i].name===propertyName){
            changeHandler.call(changes[i],changes[i].object[changes[i].name]);
            break;
          }
      },callOnInit);

      return {
        destroy:function(){
          this.removeChangeHandler(target,onPropertyChange);
        }.bind(this),
        restore:function(){
          this.addChangeHandler(target,onPropertyChange,callOnInit);
        }.bind(this)
      };
    },
    getProxy:function(target){
      validateTarget(target);

      return proxyStack[targetIndex(target)];
    },
    removeChangeHandler:function(target,changeHandler){
      validateTarget(target);

      var targetInd=targetIndex(target),rmInd;
      if((rmInd=handlerStack[targetInd].indexOf(changeHandler))>-1)
        handlerStack[targetInd].splice(rmInd,1);
      else
        handlerStack[targetInd]=[];

      clearTimeout(timeoutStack[targetInd]);
    }
  }
}.bind(this)([],[],[],[],[]);

function _o(target,changeHandler,callOnInit)
{
  if(changeHandler)
    observingProxy.addChangeHandler(target,changeHandler,callOnInit);

  return observingProxy.getProxy(target);
}

_o.observe=observingProxy.addChangeHandler;
_o.unobserve=observingProxy.removeChangeHandler;
_o.observeProperty=observingProxy.addPropertyHandler;

if(typeof Object.defineProperty!=='function')
  throw 'Object.defineProperty is not a function';

if(this.module&&this.module.exports)
  this.module.exports=_o;
else if(this.define&&this.define.amd)
  this.define(function(){return _o});
else
  this._o=_o;

if(this.test_o)
  tl('getProxy',function(){
    var s={p1:1};
    return observingProxy.getProxy(s).p1===s.p1});

if(this.test_o)
  !function(){
    var u;
    var s={p1:1};
    observingProxy.addChangeHandler(s,function(changes){
      clearTimeout(u);
      tl('addChangeHandler',function(){return true});
    });
    observingProxy.getProxy(s).p1=101;
    u=setTimeout(function(){
      tl('addChangeHandler',function(){return false});
    });
  }();

if(this.test_o)
  !function(){
    var u;
    var f=function(){
      clearTimeout(u);
      tl('removeChangeHandler',function(){return false});
    };
    var s={p1:1};
    observingProxy.addChangeHandler(s,f);
    observingProxy.removeChangeHandler(s,f);
    observingProxy.getProxy(s).p1=2;
    u=setTimeout(function(){
      tl('removeChangeHandler',function(){return true});
    });
  }();

if(this.test_o)
  !function(){
    var s={p1:0},proxy=observingProxy.getProxy(s),n=0;
    observingProxy.addChangeHandler(s,function(ch){
      n++;
    });
    for(var i=10;i--;)
      proxy.p1++;
    setTimeout(function(){
      tl('Delayed notify',function(){return n===1});
    })
  }();

if(this.test_o)
  !function(){
    var u;
    var s={p1:1};
    observingProxy.addPropertyHandler(s,'p1',function(value){
      clearTimeout(u);
      tl('addPropertyHandler',function(){return value===2});
    });
    observingProxy.getProxy(s).p1=2;
    u=setTimeout(function(){
      tl('addPropertyHandler',function(){return false});
    });
  }();

if(this.test_o)
  !function(){
    var s={p1:1},proxy=observingProxy.getProxy(s),i=0;
    var observer=observingProxy.addPropertyHandler(s,'p1',function(value){
      i++;
    });

    proxy.p1=2;
    setTimeout(function(){
      observer.destroy();
      proxy.p1=3;
      setTimeout(function(){
        observer.restore();
        proxy.p1=4;
        setTimeout(function(){
          tl('addPropertyHandler destructor',function(){return i==2});
        });
      });
    });
  }();

}.bind(this)()
