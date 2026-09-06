from pathlib import Path
import json,numpy as np
from scipy.interpolate import BSpline,CubicSpline
from scipy.optimize import minimize,LinearConstraint,linprog
out=Path('/workspace/scratch/2b912ce37941/native-render/camera-timing-study');data=json.loads((out/'camera-input.json').read_text());samples=data['samples']
t=np.array([s['time'] for s in samples]);old=np.array([s['oldY'] for s in samples]);ground=np.array([s['ground'] for s in samples]);canopy=np.array([s['canopy'] if s['canopy'] is not None else np.nan for s in samples]);rocks=np.array([s['rockTop'] if s['rockTop'] is not None else np.nan for s in samples])
# Exact natural-cubic base used by production, not numerical derivative estimates.
key_t=[0, 1.5, 3.0, 4.5, 5.8, 7.2, 9.0, 10.8, 12.8, 14.7, 16.5, 18, 20];key_y=[343,286,210,117,54,15,5.6,4.8,4.8,5,5.2,5.8,6.6]
base=CubicSpline(key_t,key_y,bc_type='natural')
minimum=ground+3.2;cm=np.isfinite(canopy);rm=np.isfinite(rocks);minimum[cm]=np.maximum(minimum[cm],canopy[cm]+3.2);minimum[rm]=np.maximum(minimum[rm],rocks[rm]+2.2)
# A curve ending with fixed position/velocity cannot have been higher than this
# backward reachable envelope when |vertical acceleration| is capped at 25.
end=11.;dt=end-t;ceiling=base(end)-base(end,1)*dt+.5*25*dt*dt
valid=(dt>=0);shortfall=np.where(valid,minimum-ceiling,-np.inf);i=int(np.argmax(shortfall))
proof={'endTime':11.,'endHeight':float(base(end)),'endVerticalVelocity':float(base(end,1)),'limitingTime':float(t[i]),'requiredHeight':float(minimum[i]),'maximumReachableHeightWith25Acceleration':float(ceiling[i]),'shortfallMetres':float(shortfall[i]),'infeasible':bool(shortfall[i]>1e-8)}
print('elevenSecondProof',proof,flush=True)
trials=[];chosen=None
for end in [10.5,10.8,11.0]:
 active=t<=end;tc=t[active];degree=5;knots=np.r_[np.zeros(degree+1),np.arange(.4,end-.001,.4),np.full(degree+1,end)];n=len(knots)-degree-1
 basis=BSpline(knots,np.eye(n),degree);B=basis(tc);D=basis.derivative(1)(tc);D2=basis.derivative(2)(tc);D3=basis.derivative(3)(tc)
 by=base(tc);bv=base(tc,1);ba=base(tc,2);bj=base(tc,3)
 A=np.vstack([-B,D,-D,D2,-D2]);b=np.r_[-(minimum[active]-by),-bv,78.45+bv,29.95-ba,29.95+ba]
 terminal=np.vstack([np.eye(n)[-3:],B[0]])
 terminalValues=np.r_[np.zeros(3),minimum[0]+6-by[0]]
 lp=linprog(np.zeros(n),A_ub=A,b_ub=b,A_eq=terminal,b_eq=terminalValues,bounds=[(None,None)]*n,method='highs')
 trial={'endTime':end,'feasible':bool(lp.success),'status':lp.message};trials.append(trial);print('trial',trial,flush=True)
 if not lp.success or end<10.5:continue
 # Broad lower envelope plus strong jerk/acceleration penalties. Safety and
 # smoothness outrank matching the individual crown discontinuities.
 target=np.maximum(minimum[active]+4,ground[active]+8)
 weights=np.ones_like(tc);H=1.0*B.T@(weights[:,None]*B)+1.1*(D2.T@D2)+6.0*(D3.T@D3)+np.eye(n)*1e-5
 f=1.0*B.T@(weights*(by-target))+1.1*D2.T@ba+6.0*D3.T@bj
 constraints=[LinearConstraint(A,-np.inf,b),LinearConstraint(terminal,terminalValues,terminalValues)]
 scale=max(1000,np.linalg.norm(H,ord=2)*.02)
 result=minimize(lambda c:(.5*c@H@c+f@c)/scale,lp.x,jac=lambda c:(H@c+f)/scale,method='SLSQP',constraints=constraints,options={'maxiter':800,'ftol':1e-9})
 c=result.x;y=base(t);y[active]=by+B@c
 dense=np.linspace(0,end,round(end*600)+1);denseY=base(dense)+basis(dense)@c;denseV=base(dense,1)+basis.derivative(1)(dense)@c;denseA=base(dense,2)+basis.derivative(2)(dense)@c;denseJ=base(dense,3)+basis.derivative(3)(dense)@c
 violation=max(float(np.max(A@c-b)),float(abs(terminal@c-terminalValues).max()))
 chosen={'endTime':end,'optimizerSuccess':bool(result.success),'optimizerMessage':result.message,'constraintViolation':violation,'degree':degree,'knots':knots.tolist(),'coefficients':c.tolist(),'minTerrainClearance':float((y-ground).min()),'minTreeBoxClearance':float((y[cm]-canopy[cm]).min()),'minRockBoxClearance':float((y[rm]-rocks[rm]).min()),'denseDerivativeSamples':len(dense),'minVerticalVelocity':float(denseV.min()),'maxVerticalVelocity':float(denseV.max()),'maxAbsoluteVerticalAcceleration':float(abs(denseA).max()),'maxAbsoluteVerticalJerk':float(abs(denseJ).max()),'jerkRMS':float(np.sqrt(np.mean(denseJ*denseJ))),'startHeight':float(y[0]),'representativeHeights':[{'time':float(t[k]),'old':float(old[k]),'candidate':float(y[k]),'terrain':float(ground[k])} for k in range(0,len(t),60)]}
 # Dense derivative overshoots are concrete remaining risk; tighten solve by
 # adding the dense derivative rows rather than claiming sampled limits suffice.
 if denseV.min()<-78.501 or denseV.max()>.001 or abs(denseA).max()>30.001:
  BD=basis.derivative(1)(dense);BD2=basis.derivative(2)(dense);dv=base(dense,1);da=base(dense,2)
  AD=np.vstack([BD,-BD,BD2,-BD2]);bd=np.r_[-dv,78.45+dv,29.95-da,29.95+da]
  constraints=[LinearConstraint(np.vstack([A,AD]),-np.inf,np.r_[b,bd]),LinearConstraint(terminal,terminalValues,terminalValues)]
  result=minimize(lambda q:(.5*q@H@q+f@q)/scale,c,jac=lambda q:(H@q+f)/scale,method='SLSQP',constraints=constraints,options={'maxiter':500,'ftol':1e-9})
  c=result.x;y[active]=by+B@c;denseV=base(dense,1)+BD@c;denseA=base(dense,2)+BD2@c;denseJ=base(dense,3)+basis.derivative(3)(dense)@c
  chosen.update(optimizerSuccess=bool(result.success),optimizerMessage=result.message,coefficients=c.tolist(),constraintViolation=float(max(np.max(A@c-b),np.max(AD@c-bd))),minVerticalVelocity=float(denseV.min()),maxVerticalVelocity=float(denseV.max()),maxAbsoluteVerticalAcceleration=float(abs(denseA).max()),maxAbsoluteVerticalJerk=float(abs(denseJ).max()),jerkRMS=float(np.sqrt(np.mean(denseJ*denseJ))),minTerrainClearance=float((y-ground).min()),minTreeBoxClearance=float((y[cm]-canopy[cm]).min()),minRockBoxClearance=float((y[rm]-rocks[rm]).min()),startHeight=float(y[0]),representativeHeights=[{'time':float(t[k]),'old':float(old[k]),'candidate':float(y[k]),'terrain':float(ground[k])} for k in range(0,len(t),60)])
 (out/'camera-samples.json').write_text(json.dumps([dict(s,candidateY=float(y[k])) for k,s in enumerate(samples)])+'\n')
 break
report={'elevenSecondProof':proof,'trials':trials,'candidate':chosen};(out/'camera-fit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({**report,'candidate':{k:v for k,v in (chosen or {}).items() if k not in ['knots','coefficients','representativeHeights']}},indent=2))
if chosen is None or chosen['constraintViolation']>1e-5 or chosen['minVerticalVelocity']<-78.501 or chosen['maxAbsoluteVerticalAcceleration']>30.001:raise SystemExit('No validated restrained candidate')
