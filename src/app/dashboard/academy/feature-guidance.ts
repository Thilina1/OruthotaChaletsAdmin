type Control = { kind: string; label: string };
export function advice({kind,label}:Control):string {
  const name=`“${label}”`;
  if(kind==='tab') return `${name} තෝරා එම කොටසට අදාළ වාර්තා බලන්න. වෙනත් tab එකකට මාරු වීමට පෙර පුරවමින් ඇති form එක save කර තිබේද බලන්න.`;
  if(kind==='column') return `${name} තීරුවෙන් එක් එක් record එකේ මෙම අගය සසඳන්න. මුදල් හෝ ගණනක් නම් දිනය, ඒකකය සහ තෝරා ඇති filters සමඟ කියවන්න.`;
  if(kind==='section') return `${name} කොටසෙන් අදාළ සාරාංශය හෝ සැකසුම් බලන්න. පෙන්වන තොරතුරු තෝරා ඇති දිනය සහ record එකට අදාළද තහවුරු කරන්න.`;
  if(/search/i.test(label)) return `${name} තුළ නම, reference හෝ පෙන්වා ඇති සෙවුම් වචනය ලියන්න. ප්‍රතිඵල නැත්නම් spelling හා අනෙකුත් filters බලලා සෙවුම හිස් කරන්න.`;
  if(kind==='field') {
    if(/amount|price|cost|rate|salary|balance/i.test(label)) return `${name} සඳහා අදාළ මුදල ඇතුළත් කරන්න. Invoice හෝ අනුමත අගය සමඟ සසඳන්න; rate එකක් නම් ඒකකය හා කාල පරාසයත් බලන්න.`;
    if(/date|time|month|year/i.test(label)) return `${name} සඳහා අදාළ දිනය හෝ වේලාව තෝරන්න. ආරම්භය හා අවසානය පිළිවෙළින්ද, නිවැරදි මාසයද බලන්න.`;
    if(/quantity|qty|count|unit/i.test(label)) return `${name} අගය භාණ්ඩ ගණන සහ ඒකකය සමඟ සසඳා පුරවන්න. kg, packet සහ pieces එකම ඒකකයක් ලෙස ගන්න එපා.`;
    if(/password/i.test(label)) return `${name} පෞද්ගලිකව පුරවන්න. වෙනත් සේවකයෙකුගේ password එක යොදා නොගන්න; පෙන්වන password අවශ්‍යතා අනුගමනය කරන්න.`;
    return `${name} යටතේ ඉල්ලා ඇති තොරතුර ඇතුළත් කරන්න හෝ ලැයිස්තුවෙන් තෝරන්න. අනිවාර්ය සලකුණක් සහ validation message එකක් තිබේ නම් ඒ අනුව නිවැරදි කරන්න.`;
  }
  if(/export|download|print/i.test(label)) return `${name} කිරීමට පෙර date range සහ filters සකසන්න. ලබාගත් file එක හෝ print preview එකේ නම, කාල පරාසය හා එකතුව නිවැරදිද බලන්න.`;
  if(/^(cancel|close|go back|back)(\b|\s|$)/i.test(label)) return `${name} තෝරා ඉවත් වීමට පෙර save නොකළ වෙනස්කම් තිබේද බලන්න. Booking/order cancellation එකක් නම් පෙන්වන confirmation එක සහ බලපෑම තහවුරු කරන්න.`;
  if(/^(view|show|refresh)/i.test(label)) return `${name} භාවිත කර අදාළ විස්තර බලන්න හෝ ලැයිස්තුව නැවත ලබාගන්න. පෙන්වන record එක හා තෝරා ඇති දිනය නිවැරදිද බලන්න.`;
  if(/delete|remove|void/i.test(label)) return `${name} තෝරා ගැනීමට පෙර නිවැරදි record එකද සහ ඉවත් කිරීමේ බලපෑමද බලන්න. Confirmation එකේ නම/විස්තර කියවා අවශ්‍ය විට පමණක් තහවුරු කරන්න.`;
  if(/reject|decline/i.test(label)) return `${name} කිරීමට පෙර request එක සහ supporting details කියවන්න. Reason ඉල්ලා තිබේ නම් පැහැදිලි හේතුවක් සටහන් කර පසුව status එක බලන්න.`;
  if(/approv|confirm|final|settle|pay|checkout|check out/i.test(label)) return `${name} කිරීමට පෙර අදාළ පුද්ගලයා, record එක, මුදල හා දිනය තහවුරු කරන්න. ක්‍රියාව එක්වරක් කර ලැබෙන ප්‍රතිචාරය හා අලුත් status එක බලන්න; ප්‍රමාදයකදී නැවත submit නොකරන්න.`;
  if(/edit|update/i.test(label)) return `${name} මගින් තෝරා ඇති record එකේ තොරතුරු බලන්න. අවශ්‍ය අගයන් වෙනස් කර save කිරීමෙන් පසු ලැයිස්තුවේ වෙනස තහවුරු කරන්න.`;
  if(/add|new|create/i.test(label)) return `${name} තෝරා පෙන්වන form එකේ අනිවාර්ය තොරතුරු පුරවන්න. එකම record එක දැනට තිබේද බලලා submit කර අලුත් record එක ලැයිස්තුවේ සොයන්න.`;
  if(/cancel|close|back/i.test(label)) return `${name} මගින් ඉවත් වීමට පෙර save නොකළ වෙනස්කම් තිබේද බලන්න. Booking/order cancellation එකක් නම් confirmation එක කියවා බලපෑම තහවුරු කරන්න.`;
  if(/next|previous|first page|last page/i.test(label)) return `${name} මගින් ලැයිස්තුවේ පිටුව මාරු කරන්න. සෙවුම හා filters තවම ක්‍රියාත්මකද බලන්න; පිටුව මාරු කිරීමෙන් වාර්තා වෙනස් නොවේ.`;
  if(/save|submit/i.test(label)) return `${name} කිරීමට පෙර form එකේ අනිවාර්ය අගයන් බලන්න. එක්වරක් submit කර error එකක් තිබේ නම් නිවැරදි කරන්න; success පසු record එක නැවත බලන්න.`;
  return `${name} පාලකය භාවිත කිරීමට පෙර තෝරා ඇති record එක හා දිනය බලන්න. පෙන්වන උපදෙස් හෝ confirmation එක කියවා, ක්‍රියාවෙන් පසු status/ප්‍රතිඵලය තහවුරු කරන්න.`;
}
