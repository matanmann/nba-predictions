'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useLockStatus } from '@/hooks/useLockStatus'
import { useRouter } from 'next/navigation'
import { savePredictionsToLocalStorage, loadPredictionsFromLocalStorage, clearPredictionsFromLocalStorage } from '@/lib/lock'

interface Team { id: string; name: string; abbr: string; seed: number; conference: string; color: string }
interface Series { id: string; round: number; conference: string; label: string; homeTeam: Team; awayTeam: Team }
interface SnackQuestion { id: number; order: number; question: string }
interface GeneralQuestion { key: string; label: string; type: string }
interface SeasonData { series: Series[]; snackQuestions: SnackQuestion[]; generalConfig: { questions: GeneralQuestion[] } }
interface GroupInfo { id: string; name: string; code: string; season: { year: number } }

const TEAM_LOGOS: Record<string, string> = {
  CLE: 'https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg',
  BOS: 'https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg',
  NYK: 'https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg',
  IND: 'https://cdn.nba.com/logos/nba/1610612754/primary/L/logo.svg',
  ORL: 'https://cdn.nba.com/logos/nba/1610612753/primary/L/logo.svg',
  MIL: 'https://cdn.nba.com/logos/nba/1610612749/primary/L/logo.svg',
  DET: 'https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg',
  ATL: 'https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg',
  MIA: 'https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg',
  CHI: 'https://cdn.nba.com/logos/nba/1610612741/primary/L/logo.svg',
  OKC: 'https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg',
  HOU: 'https://cdn.nba.com/logos/nba/1610612745/primary/L/logo.svg',
  GSW: 'https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg',
  MEM: 'https://cdn.nba.com/logos/nba/1610612763/primary/L/logo.svg',
  DEN: 'https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg',
  LAC: 'https://cdn.nba.com/logos/nba/1610612746/primary/L/logo.svg',
  MIN: 'https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg',
  DAL: 'https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg',
  PHI: 'https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg',
  PHX: 'https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg',
  SAC: 'https://cdn.nba.com/logos/nba/1610612758/primary/L/logo.svg',
  NOP: 'https://cdn.nba.com/logos/nba/1610612740/primary/L/logo.svg',
  LAL: 'https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg',
  POR: 'https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg',
  TOR: 'https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg',
  SAS: 'https://cdn.nba.com/logos/nba/1610612764/primary/L/logo.svg',
}

const DEFAULT_TEAM_LOGO = 'https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg'
const DEFAULT_PLAYER_IMAGE = 'https://cdn.nba.com/headshots/nba/latest/1040x760/fallback.png'

// Player image mapping for key players (NBA headshot URLs)
const PLAYER_IMAGES: Record<string, string> = {
  'Stephen Curry': 'https://cdn.nba.com/headshots/nba/latest/1040x760/201939.png',
  'LeBron James': 'https://cdn.nba.com/headshots/nba/latest/1040x760/2544.png',
  'Kevin Durant': 'https://cdn.nba.com/headshots/nba/latest/1040x760/201142.png',
  'Giannis Antetokounmpo': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203507.png',
  'Nikola Jokic': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203999.png',
  'Luka Doncic': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629029.png',
  'Jayson Tatum': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628369.png',
  'Jimmy Butler': 'https://cdn.nba.com/headshots/nba/latest/1040x760/202710.png',
  'Anthony Edwards': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630162.png',
  'Shai Gilgeous-Alexander': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628983.png',
  'Donovan Mitchell': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628378.png',
  'Ja Morant': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629630.png',
  'Zion Williamson': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629627.png',
  'Kawhi Leonard': 'https://cdn.nba.com/headshots/nba/latest/1040x760/202695.png',
  'Deni Avdija': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630163.png',
  'Trae Young': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629027.png',
  'Jalen Brunson': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628973.png',
  'Tyrese Haliburton': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630169.png',
  'Cade Cunningham': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630595.png',
  'Paolo Banchero': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631094.png',
  'Victor Wembanyama': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641705.png',
  'Chet Holmgren': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631096.png',
  'Draymond Green': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203110.png',
  'James Harden': 'https://cdn.nba.com/headshots/nba/latest/1040x760/201935.png',
  'Russell Westbrook': 'https://cdn.nba.com/headshots/nba/latest/1040x760/201566.png',
  'Damian Lillard': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203081.png',
  'Kyrie Irving': 'https://cdn.nba.com/headshots/nba/latest/1040x760/202681.png',
  'Joel Embiid': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203954.png',
  'Devin Booker': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1626164.png',
  'Bradley Beal': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203078.png',
  'Bam Adebayo': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628389.png',
  'Anthony Davis': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203076.png',
  'Julius Randle': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203944.png',
  'Karl-Anthony Towns': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1626157.png',
  'Pascal Siakam': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1627783.png',
  'Fred VanVleet': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1627832.png',
  'Jalen Green': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630224.png',
  'Alperen Sengun': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630578.png',
  'Jaylen Brown': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1627759.png',
  'Jrue Holiday': 'https://cdn.nba.com/headshots/nba/latest/1040x760/201950.png',
  'Mikal Bridges': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628969.png',
  'OG Anunoby': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628384.png',
  'DeMar DeRozan': 'https://cdn.nba.com/headshots/nba/latest/1040x760/201942.png',
  'Domantas Sabonis': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1627734.png',
  'CJ McCollum': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203468.png',
  'Brandon Ingram': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1627742.png',
  'Zach LaVine': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203897.png',
  'Nikola Vucevic': 'https://cdn.nba.com/headshots/nba/latest/1040x760/202696.png',
  'Evan Mobley': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630596.png',
  'Darius Garland': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629636.png',
  'Jarrett Allen': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628386.png',
  'Miles McBride': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630540.png',
  'Mitchell Robinson': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629011.png',
  'Josh Hart': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628404.png',
  'Cameron Payne': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1626166.png',
  'Donte DiVincenzo': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628978.png',
  'Jericho Sims': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630579.png',
  'Pacome Dadiet': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641764.png',
  'Charlie Brown Jr.': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629718.png',
  'Andrew Nembhard': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629614.png',
  'Myles Turner': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1626167.png',
  'Bennedict Mathurin': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631097.png',
  'Aaron Nesmith': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630174.png',
  'T.J. McConnell': 'https://cdn.nba.com/headshots/nba/latest/1040x760/204456.png',
  'Obi Toppin': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630167.png',
  'Isaiah Jackson': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630543.png',
  'Jarace Walker': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641716.png',
  'Ben Sheppard': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641767.png',
  'Kendrick Nunn': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629134.png',
  'Damiris Dantas': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1642378.png',
  'Franz Wagner': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630532.png',
  'Jalen Suggs': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630591.png',
  'Wendell Carter Jr.': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628976.png',
  'Jonathan Isaac': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628371.png',
  'Kentavious Caldwell-Pope': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203484.png',
  'Cole Anthony': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630175.png',
  'Goga Bitadze': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629048.png',
  'Moritz Wagner': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629021.png',
  'Anthony Black': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641710.png',
  'Jett Howard': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641722.png',
  'Gary Harris': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203914.png',
  'Trevelin Queen': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630243.png',
  'Khris Middleton': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203114.png',
  'Brook Lopez': 'https://cdn.nba.com/headshots/nba/latest/1040x760/201572.png',
  'Bobby Portis': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1626171.png',
  'Pat Connaughton': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1626192.png',
  'AJ Green': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631260.png',
  'Andre Jackson Jr.': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641748.png',
  'Gary Trent Jr.': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629018.png',
  'Taurean Prince': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1627752.png',
  'MarJon Beauchamp': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630699.png',
  'Delonte Washington': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629635.png',
  'Ryan Rollins': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631157.png',
  'Jaden Ivey': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631093.png',
  'Jalen Duren': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631105.png',
  'Ausar Thompson': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641708.png',
  'Malik Beasley': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1627736.png',
  'Tim Hardaway Jr.': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203501.png',
  'Tobias Harris': 'https://cdn.nba.com/headshots/nba/latest/1040x760/202699.png',
  'Isaiah Stewart': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630191.png',
  'Simone Fontecchio': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631323.png',
  'Marcus Sasser': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631204.png',
  'Ron Holland': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641798.png',
  'Tosan Evbuomwan': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641787.png',
  'Bob Cousy': 'https://cdn.nba.com/headshots/nba/latest/1040x760/fallback.png',
  'Jalen Johnson': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630552.png',
  'De\'Andre Hunter': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629631.png',
  'Clint Capela': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203991.png',
  'Dyson Daniels': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630700.png',
  'Bogdan Bogdanovic': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203992.png',
  'Zaccharie Risacher': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1642258.png',
  'Larry Nance Jr.': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1626204.png',
  'Garrison Mathews': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629726.png',
  'Kobe Bufkin': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641723.png',
  'Onyeka Okongwu': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630168.png',
  'Vince Carter': 'https://cdn.nba.com/headshots/nba/latest/1040x760/fallback.png',
  'Bruno Fernando': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628981.png',
  'Tyler Herro': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629639.png',
  'Terry Rozier': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1626179.png',
  'Jaime Jaquez Jr.': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631170.png',
  'Duncan Robinson': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629130.png',
  'Nikola Jovic': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631107.png',
  'Kevin Love': 'https://cdn.nba.com/headshots/nba/latest/1040x760/201567.png',
  'Haywood Highsmith': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629312.png',
  'Josh Richardson': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1626196.png',
  'Thomas Bryant': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628418.png',
  'Kyle Lowry': 'https://cdn.nba.com/headshots/nba/latest/1040x760/200768.png',
  'Caleb Martin': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628997.png',
  'Coby White': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629632.png',
  'Patrick Williams': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630172.png',
  'Ayo Dosunmu': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630245.png',
  'Josh Giddey': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630581.png',
  'Andre Drummond': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203083.png',
  'Torrey Craig': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628470.png',
  'Jevon Carter': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628975.png',
  'Julian Phillips': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641763.png',
  'Chennedy Carter': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641741.png',
  'Dalen Terry': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631207.png',
  'Matas Buzelis': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1642355.png',
  'Jalen Williams': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631114.png',
  'Lu Dort': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629652.png',
  'Isaiah Hartenstein': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628404.png',
  'Alex Caruso': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1627936.png',
  'Aaron Wiggins': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630598.png',
  'Kenrich Williams': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629026.png',
  'Isaiah Joe': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630198.png',
  'Ousmane Dieng': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631172.png',
  'Cason Wallace': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641717.png',
  'Jaylin Williams': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631119.png',
  'Luguentz Dort': 'https://cdn.nba.com/headshots/nba/latest/1040x760/fallback.png',
  'Jabari Smith Jr.': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631095.png',
  'Dillon Brooks': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628415.png',
  'Amen Thompson': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641706.png',
  'Tari Eason': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631106.png',
  'Steven Adams': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203500.png',
  'Cam Whitmore': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641715.png',
  'Jeff Green': 'https://cdn.nba.com/headshots/nba/latest/1040x760/201145.png',
  'Reed Sheppard': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1642264.png',
  'Nate Williams': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1642004.png',
  'Jermaine Samuels': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631257.png',
  'Andrew Wiggins': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203952.png',
  'Kevon Looney': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1626172.png',
  'Buddy Hield': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1627741.png',
  'Gary Payton II': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1627780.png',
  'Brandin Podziemski': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641764.png',
  'Trayce Jackson-Davis': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631218.png',
  'Moses Moody': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630541.png',
  'De\'Anthony Melton': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629001.png',
  'Gui Santos': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1642348.png',
  'Lester Quinones': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631311.png',
  'Desmond Bane': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630217.png',
  'Jaren Jackson Jr.': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628991.png',
  'Marcus Smart': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203935.png',
  'Zach Edey': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641733.png',
  'Luke Kennard': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628379.png',
  'GG Jackson': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641713.png',
  'Santi Aldama': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630583.png',
  'John Konchar': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629723.png',
  'Brandon Clarke': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629634.png',
  'Scotty Pippen Jr.': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630590.png',
  'Jake LaRavia': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631222.png',
  'Yuki Togashi': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641816.png',
  'Jamal Murray': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1627750.png',
  'Michael Porter Jr.': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629008.png',
  'Aaron Gordon': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203932.png',
  'Christian Braun': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631128.png',
  'Peyton Watson': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631212.png',
  'Julian Strawther': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631124.png',
  'Dario Saric': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203967.png',
  'Zeke Nnaji': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630192.png',
  'DeAndre Jordan': 'https://cdn.nba.com/headshots/nba/latest/1040x760/201599.png',
  'Hunter Tyson': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641817.png',
  'Braxton Key': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641734.png',
  'Ivica Zubac': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1627826.png',
  'Norman Powell': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1626181.png',
  'Terance Mann': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629611.png',
  'Derrick Jones Jr.': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1627884.png',
  'Amir Coffey': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631099.png',
  'Bones Hyland': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630538.png',
  'P.J. Tucker': 'https://cdn.nba.com/headshots/nba/latest/1040x760/200782.png',
  'Kris Dunn': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631088.png',
  'Brandon Boston Jr.': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630527.png',
  'Montrezl Harrell': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1626149.png',
  'Lou Williams': 'https://cdn.nba.com/headshots/nba/latest/1040x760/fallback.png',
  'Rudy Gobert': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203497.png',
  'Jaden McDaniels': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630183.png',
  'Mike Conley': 'https://cdn.nba.com/headshots/nba/latest/1040x760/201144.png',
  'Naz Reid': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629675.png',
  'Nickeil Alexander-Walker': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629638.png',
  'Joe Ingles': 'https://cdn.nba.com/headshots/nba/latest/1040x760/204060.png',
  'Josh Minott': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631169.png',
  'Rob Dillingham': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1642263.png',
  'Leonard Miller': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631159.png',
  'Wendell Moore Jr.': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631111.png',
  'Troy Brown Jr.': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628972.png',
  'P.J. Washington': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629216.png',
  'Daniel Gafford': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629655.png',
  'Dereck Lively II': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641726.png',
  'Klay Thompson': 'https://cdn.nba.com/headshots/nba/latest/1040x760/202691.png',
  'Naji Marshall': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630230.png',
  'Quentin Grimes': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629656.png',
  'Dante Exum': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203957.png',
  'Jaden Hardy': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630702.png',
  'Dwight Powell': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203939.png',
  'Markieff Morris': 'https://cdn.nba.com/headshots/nba/latest/1040x760/202693.png',
  'Spencer Dinwiddie': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203915.png',
  'Jusuf Nurkic': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203994.png',
  'Grayson Allen': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628960.png',
  'Royce O\'Neale': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1626220.png',
  'Eric Gordon': 'https://cdn.nba.com/headshots/nba/latest/1040x760/202329.png',
  'Josh Okogie': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629006.png',
  'Drew Eubanks': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629234.png',
  'Bol Bol': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629626.png',
  'Nassir Little': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629642.png',
  'Damion Lee': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1627814.png',
  'Ish Wainright': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630688.png',
  'De\'Aaron Fox': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628368.png',
  'Keegan Murray': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631099.png',
  'Malik Monk': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628370.png',
  'Kevin Huerter': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628989.png',
  'Trey Lyles': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1626168.png',
  'Keon Ellis': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631165.png',
  'Alex Len': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203458.png',
  'Colby Jones': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641732.png',
  'Davion Mitchell': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630558.png',
  'Harrison Barnes': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203084.png',
  'Chris Duarte': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630537.png',
  'Trey Murphy III': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630530.png',
  'Herb Jones': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630529.png',
  'Jonas Valanciunas': 'https://cdn.nba.com/headshots/nba/latest/1040x760/202685.png',
  'Jose Alvarado': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630631.png',
  'Dejounte Murray': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1627749.png',
  'Jordan Hawkins': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641721.png',
  'Austin Reaves': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630559.png',
  'D\'Angelo Russell': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1626156.png',
  'Rui Hachimura': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629060.png',
  'Jarred Vanderbilt': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629020.png',
  'Gabe Vincent': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629216.png',
  'Christian Wood': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1626174.png',
  'Cam Reddish': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629629.png',
  'Max Christie': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631108.png',
  'Jalen Hood-Schifino': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641720.png',
  'Jaxson Hayes': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629637.png',
  'Dorian Finney-Smith': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1627827.png',
  'Anfernee Simons': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629014.png',
  'Jerami Grant': 'https://cdn.nba.com/headshots/nba/latest/1040x760/203924.png',
  'Deandre Ayton': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629028.png',
  'Shaedon Sharpe': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631101.png',
  'Toumani Camara': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1641739.png',
  'Donovan Clingan': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1642271.png',
  'Robert Williams III': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629057.png',
  'Scoot Henderson': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630703.png',
  'Kris Murray': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1631200.png',
  'Dalano Banton': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1630625.png',
  'Matisse Thybulle': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1629680.png',
  'Justin Minaya': 'https://cdn.nba.com/headshots/nba/latest/1040x760/1642335.png',
}

const PLAYOFF_PLAYERS: Record<string, string[]> = {
  // --- Eastern Conference Playoff Teams ---
  DET: ['Cade Cunningham','Jaden Ivey','Ausar Thompson','Jalen Duren','Malik Beasley','Tim Hardaway Jr.','Tobias Harris','Isaiah Stewart','Simone Fontecchio','Marcus Sasser','Ron Holland','Tosan Evbuomwan'],
  BOS: ['Jayson Tatum','Jaylen Brown','Derrick White','Anfernee Simons','Kristaps Porzingis','Payton Pritchard','Al Horford','Sam Hauser','Luke Kornet','Neemias Queta','Xavier Tillman','Oshae Brissett','JD Davison'], // סיימונס הגיע, הולידיי עזב
  NYK: ['Jalen Brunson','Karl-Anthony Towns','Mikal Bridges','OG Anunoby','Josh Hart','Miles McBride','Mitchell Robinson','Precious Achiuwa','Cameron Payne','Donte DiVincenzo','Jericho Sims','Pacome Dadiet','Charlie Brown Jr.'],
  CLE: ['Donovan Mitchell','Darius Garland','Evan Mobley','Jarrett Allen','Max Strus','Caris LeVert','Isaac Okoro','Sam Merrill','Georges Niang','Dean Wade','Ty Jerome','Craig Porter Jr.','Tristan Thompson'],
  TOR: ['Scottie Barnes','RJ Barrett','Immanuel Quickley','Jakob Poeltl','Grady Dick','Bruce Brown','Kelly Olynyk','Davion Mitchell','Ochai Agbaji'],
  ATL: ['Trae Young','Jalen Johnson','De\'Andre Hunter','Clint Capela','Dyson Daniels','Bogdan Bogdanovic','Zaccharie Risacher','Larry Nance Jr.','Garrison Mathews','Kobe Bufkin','Onyeka Okongwu','Bruno Fernando'],
  PHI: ['Joel Embiid','Tyrese Maxey','Paul George','Kelly Oubre Jr.','Caleb Martin','Kyle Lowry','Eric Gordon','Andre Drummond','Guerschon Yabusele','Ricky Council IV'],
  MIA: ['Jimmy Butler','Bam Adebayo','Tyler Herro','Terry Rozier','Jaime Jaquez Jr.','Duncan Robinson','Nikola Jovic','Kevin Love','Haywood Highsmith','Josh Richardson','Thomas Bryant'],

  // --- Eastern Play-In Teams ---
  IND: ['Tyrese Haliburton','Pascal Siakam','Myles Turner','Andrew Nembhard','Bennedict Mathurin','Aaron Nesmith','T.J. McConnell','Obi Toppin','Isaiah Jackson','Jarace Walker','Ben Sheppard','Kendrick Nunn','Damiris Dantas'],
  ORL: ['Paolo Banchero','Franz Wagner','Jalen Suggs','Wendell Carter Jr.','Jonathan Isaac','Kentavious Caldwell-Pope','Cole Anthony','Goga Bitadze','Moritz Wagner','Anthony Black','Jett Howard','Gary Harris','Trevelin Queen'],

  // --- Western Conference Playoff Teams ---
  OKC: ['Shai Gilgeous-Alexander','Jalen Williams','Chet Holmgren','Lu Dort','Isaiah Hartenstein','Alex Caruso','Aaron Wiggins','Kenrich Williams','Isaiah Joe','Ousmane Dieng','Cason Wallace','Jaylin Williams'],
  SAS: ['Victor Wembanyama','Chris Paul','Devin Vassell','Jeremy Sochan','Harrison Barnes','Stephon Castle','Keldon Johnson','Zach Collins','Malaki Branham','Blake Wesley'],
  DEN: ['Nikola Jokic','Jamal Murray','Michael Porter Jr.','Aaron Gordon','Christian Braun','Russell Westbrook','Peyton Watson','Julian Strawther','Dario Saric','Zeke Nnaji','DeAndre Jordan','Hunter Tyson','Braxton Key'],
  LAL: ['Luka Doncic','LeBron James','Austin Reaves','D\'Angelo Russell','Rui Hachimura','Jarred Vanderbilt','Gabe Vincent','Christian Wood','Cam Reddish','Max Christie','Jalen Hood-Schifino','Jaxson Hayes','Dorian Finney-Smith'], // לוקה בפנים, AD יצא
  HOU: ['Jalen Green','Kevin Durant','Alperen Sengun','Fred VanVleet','Jabari Smith Jr.','Dillon Brooks','Amen Thompson','Tari Eason','Steven Adams','Cam Whitmore','Jeff Green','Reed Sheppard','Nate Williams','Jermaine Samuels'],
  MIN: ['Anthony Edwards','Julius Randle','Rudy Gobert','Jaden McDaniels','Mike Conley','Naz Reid','Nickeil Alexander-Walker','Joe Ingles','Josh Minott','Rob Dillingham','Leonard Miller','Wendell Moore Jr.','Troy Brown Jr.'],
  POR: ['Deni Avdija','Jrue Holiday','Jerami Grant','Deandre Ayton','Shaedon Sharpe','Toumani Camara','Donovan Clingan','Robert Williams III','Scoot Henderson','Kris Murray','Dalano Banton','Matisse Thybulle','Justin Minaya'], // הולידיי בפנים, סיימונס עזב
  PHX: ['Kevin Durant','Devin Booker','Bradley Beal','Jusuf Nurkic','Grayson Allen','Royce O\'Neale','Eric Gordon','Josh Okogie','Drew Eubanks','Bol Bol','Nassir Little','Damion Lee','Ish Wainright'],

  // --- Western Play-In Teams ---
  GSW: ['Stephen Curry','Andrew Wiggins','Draymond Green','Jonathan Kuminga','Kevon Looney','Buddy Hield','Gary Payton II','Brandin Podziemski','Trayce Jackson-Davis','Moses Moody','De\'Anthony Melton','Gui Santos','Lester Quinones'],
  SAC: ['De\'Aaron Fox','Domantas Sabonis','Keegan Murray','DeMar DeRozan','Malik Monk','Kevin Huerter','Trey Lyles','Keon Ellis','Alex Len','Colby Jones','Davion Mitchell','Harrison Barnes','Chris Duarte']
}

const LEADER_CATEGORIES = ['Points','Assists','Rebounds','Blocks','Steals'] as const
const ROUND_POINTS = [1, 2, 4, 8]
const TABS = ['Bracket','Leaders','General','Snacks'] as const
type Tab = typeof TABS[number]

interface BracketSeries { id: string; round: number; conference: string; label: string; homeTeam: Team | null; awayTeam: Team | null }

function buildFullBracket(r1Series: Series[], preds: Record<string, { winnerId: string; gameCount: number; leadingScorer: string }>) {
  const east = r1Series.filter(s => s.conference === 'E').sort((a, b) => a.label.localeCompare(b.label))
  const west = r1Series.filter(s => s.conference === 'W').sort((a, b) => a.label.localeCompare(b.label))
  const teamMap: Record<string, Team> = {}
  for (const s of r1Series) { teamMap[s.homeTeam.id] = s.homeTeam; teamMap[s.awayTeam.id] = s.awayTeam }
  const getWinner = (sid: string): Team | null => { const p = preds[sid]; return p?.winnerId ? (teamMap[p.winnerId] ?? null) : null }
  const yr = east[0]?.id?.split('-')[0] ?? '2025'
  const buildR2 = (conf: string, r1: BracketSeries[]): BracketSeries[] => [
    { id: `${yr}-${conf}_R2A`, round: 2, conference: conf, label: `${conf} Semi A`, homeTeam: getWinner(r1[0]?.id), awayTeam: getWinner(r1[3]?.id) },
    { id: `${yr}-${conf}_R2B`, round: 2, conference: conf, label: `${conf} Semi B`, homeTeam: getWinner(r1[1]?.id), awayTeam: getWinner(r1[2]?.id) },
  ]
  const eastR2 = buildR2('E', east as BracketSeries[])
  const westR2 = buildR2('W', west as BracketSeries[])
  const ecf: BracketSeries = { id: `${yr}-ECF`, round: 3, conference: 'E', label: 'East Finals', homeTeam: getWinner(eastR2[0].id), awayTeam: getWinner(eastR2[1].id) }
  const wcf: BracketSeries = { id: `${yr}-WCF`, round: 3, conference: 'W', label: 'West Finals', homeTeam: getWinner(westR2[0].id), awayTeam: getWinner(westR2[1].id) }
  const finals: BracketSeries = { id: `${yr}-Finals`, round: 4, conference: 'Finals', label: 'NBA Finals', homeTeam: getWinner(ecf.id), awayTeam: getWinner(wcf.id) }
  return {
    east: [...east.map(s => ({ ...s } as BracketSeries)), ...eastR2, ecf],
    west: [...west.map(s => ({ ...s } as BracketSeries)), ...westR2, wcf],
    finals: [finals],
  }
}

export default function PredictClient({ year, initialGroupId }: { year: number; initialGroupId?: string }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('Bracket')
  const [seasonData, setSeasonData] = useState<SeasonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bracketPreds, setBracketPreds] = useState<Record<string, { winnerId: string; gameCount: number; leadingScorer: string }>>({})
  const [leaderPreds, setLeaderPreds] = useState<Record<string, string>>({})
  const [generalAnswers, setGeneralAnswers] = useState<Record<string, number>>({})
  const [snackAnswers, setSnackAnswers] = useState<Record<number, boolean>>({})
  const [mvpPreds, setMvpPreds] = useState<Record<string, string>>({ eastMvp: '', westMvp: '', finalsMvp: '' })
  const [submitStatus, setSubmitStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle')
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId ?? '')
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null)
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [groupError, setGroupError] = useState<string | null>(null)
  const lockStatus = useLockStatus(year)

  const fullBracket = useMemo(() => {
    if (!seasonData) return { east: [], west: [], finals: [] }
    return buildFullBracket(seasonData.series, bracketPreds)
  }, [seasonData, bracketPreds])

  const allPlayers = useMemo(() => {
    const players: string[] = []; const seen = new Set<string>()
    if (!seasonData) return players
    for (const s of seasonData.series) {
      for (const team of [s.homeTeam, s.awayTeam]) {
        if (!seen.has(team.abbr)) { seen.add(team.abbr); players.push(...(PLAYOFF_PLAYERS[team.abbr] ?? [])) }
      }
    }
    return players.sort()
  }, [seasonData])

  // Players from East/West teams for MVP dropdowns
  const eastPlayers = useMemo(() => {
    if (!seasonData) return []
    const p: string[] = []; const seen = new Set<string>()
    for (const s of seasonData.series.filter(s => s.conference === 'E')) {
      for (const t of [s.homeTeam, s.awayTeam]) { if (!seen.has(t.abbr)) { seen.add(t.abbr); p.push(...(PLAYOFF_PLAYERS[t.abbr] ?? [])) } }
    }
    return p.sort()
  }, [seasonData])

  const westPlayers = useMemo(() => {
    if (!seasonData) return []
    const p: string[] = []; const seen = new Set<string>()
    for (const s of seasonData.series.filter(s => s.conference === 'W')) {
      for (const t of [s.homeTeam, s.awayTeam]) { if (!seen.has(t.abbr)) { seen.add(t.abbr); p.push(...(PLAYOFF_PLAYERS[t.abbr] ?? [])) } }
    }
    return p.sort()
  }, [seasonData])

  useEffect(() => {
    async function load() {
      try {
        // Try to load from localStorage first
        const cachedPreds = loadPredictionsFromLocalStorage(year);
        if (cachedPreds) {
          setBracketPreds(cachedPreds.bracketPreds || {});
          setLeaderPreds(cachedPreds.leaderPreds || {});
          setGeneralAnswers(cachedPreds.generalAnswers || {});
          setSnackAnswers(cachedPreds.snackAnswers || {});
          setMvpPreds(cachedPreds.mvpPreds || { eastMvp: '', westMvp: '', finalsMvp: '' });
        }

        const res = await fetch(`/api/seasons/${year}`)
        if (!res.ok) throw new Error('Failed to load season')
        setSeasonData(await res.json())
        const predRes = await fetch(`/api/seasons/${year}/predictions`)
        if (predRes.ok) {
          const predData = await predRes.json()
          if (predData.prediction) {
            const p = predData.prediction
            const sp: Record<string, any> = {}
            for (const s of p.seriesPredictions ?? []) sp[s.seriesId] = { winnerId: s.winnerId, gameCount: s.gameCount, leadingScorer: s.leadingScorer }
            setBracketPreds(sp)
            const lp: Record<string, string> = {}
            for (const l of p.leaderPredictions ?? []) lp[l.category] = l.playerName
            setLeaderPreds(lp)
            if (p.generalPrediction?.answers) setGeneralAnswers(p.generalPrediction.answers)
            const sa: Record<number, boolean> = {}
            for (const a of p.snackAnswers ?? []) sa[a.questionId] = a.answer
            setSnackAnswers(sa)
            const mvp: Record<string, string> = {}
            for (const m of p.mvpPredictions ?? []) mvp[m.role] = m.playerName
            setMvpPreds(mvp)
          }
        }
      } catch (e: any) { setError(e.message) } finally { setLoading(false) }
    }
    load()
  }, [year])

  useEffect(() => {
    async function loadGroups() {
      try {
        const res = await fetch('/api/groups')
        if (!res.ok) throw new Error('Failed to load groups')
        const data = await res.json()
        setGroups(data.groups || [])
        if (!initialGroupId && data.groups?.length) {
          setSelectedGroupId(data.groups[0].id)
        }
      } catch (e: any) {
        setGroupError(e.message)
      } finally {
        setGroupsLoading(false)
      }
    }
    loadGroups()
  }, [initialGroupId])

  useEffect(() => {
    if (!selectedGroupId) {
      setGroupInfo(null)
      return
    }

    async function loadGroup() {
      try {
        const res = await fetch(`/api/groups/${selectedGroupId}`)
        if (!res.ok) throw new Error('Failed to load group')
        const data = await res.json()
        setGroupInfo(data.group)
      } catch (e: any) {
        setGroupError(e.message)
      }
    }

    loadGroup()
  }, [selectedGroupId])

  useEffect(() => {
    if (!selectedGroupId) return
    const params = new URLSearchParams(window.location.search)
    params.set('group', selectedGroupId)
    router.replace(`/predict/${year}?${params.toString()}`)
  }, [selectedGroupId, year, router])

  // Save bracket predictions to localStorage
  useEffect(() => {
    const predictions = { bracketPreds, leaderPreds, generalAnswers, snackAnswers, mvpPreds }
    savePredictionsToLocalStorage(year, predictions)
  }, [year, bracketPreds, leaderPreds, generalAnswers, snackAnswers, mvpPreds])

  async function handleSubmit() {
    if (!seasonData) return
    setSubmitStatus('saving')
    try {
      const res = await fetch(`/api/seasons/${year}/predictions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesPredictions: Object.entries(bracketPreds).map(([seriesId, pred]) => ({ seriesId, ...pred })),
          leaderPredictions: leaderPreds,
          mvpPredictions: mvpPreds,
          generalAnswers,
          snackAnswers: Object.entries(snackAnswers).map(([qId, answer]) => ({ questionId: +qId, answer })),
        }),
      })
      if (res.status === 423) { setSubmitStatus('error'); setError('Predictions are locked!'); return }
      if (!res.ok) throw new Error('Submit failed')
      clearPredictionsFromLocalStorage(year)
      setSubmitStatus('saved'); setTimeout(() => setSubmitStatus('idle'), 2500)
    } catch { setSubmitStatus('error'); setTimeout(() => setSubmitStatus('idle'), 3000) }
  }

  const allBracketSeries = [...fullBracket.east, ...fullBracket.west, ...fullBracket.finals]
  const bracketComplete = allBracketSeries.length > 0 && allBracketSeries.every(s => {
    if (!s.homeTeam || !s.awayTeam) return false
    const p = bracketPreds[s.id]; return p?.winnerId && p?.gameCount && p?.leadingScorer?.trim()
  }) && mvpPreds.eastMvp?.trim() && mvpPreds.westMvp?.trim() && mvpPreds.finalsMvp?.trim()
  const leadersComplete = LEADER_CATEGORIES.every(c => leaderPreds[c]?.trim())
  const generalComplete = seasonData?.generalConfig?.questions ? seasonData.generalConfig.questions.every(q => generalAnswers[q.key] !== undefined) : false
  const snacksComplete = seasonData?.snackQuestions ? seasonData.snackQuestions.every(q => snackAnswers[q.id] !== undefined) : false
  const allComplete = bracketComplete && leadersComplete && generalComplete && snacksComplete
  const isLocked = lockStatus?.locked ?? false

  if (loading) return <div className="flex items-center justify-center py-20"><div className="text-sm text-gray-400 animate-pulse">Loading predictions...</div></div>
  if (error && !seasonData) return <div className="flex items-center justify-center py-20"><div className="text-sm text-red-500">{error}</div></div>
  if (!seasonData) return null

  return (
    <div className="max-w-3xl mx-auto pb-32">
      {/* Header */}
      <div className="mb-6 rounded-2xl overflow-hidden bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg flex-shrink-0">🏀</div>
          <div>
            <h1 className="text-white text-lg font-bold tracking-tight">NBA Playoff Predictions {year}</h1>
            <p className="text-blue-300 text-xs mt-0.5">Make your picks before predictions lock</p>
          </div>
        </div>
      </div>

      {(groupsLoading || groups.length > 0 || groupInfo) && (
        <div className="mb-5 rounded-2xl bg-white border border-gray-200 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-gray-400">Prediction pool</div>
              <div className="text-sm font-semibold text-gray-900">{groupInfo?.name ?? 'Select a group'}</div>
              {groupInfo?.code && <div className="text-xs text-gray-500 mt-1">Invite code: {groupInfo.code}</div>}
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
              >
                <option value="">Choose a group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} · {group.season.year}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!groupsLoading && groups.length === 0 && !selectedGroupId && (
            <div className="mt-3 text-xs text-gray-500">No groups found. Create or join one to compare your picks with friends.</div>
          )}
          {groupError && <div className="mt-3 text-xs text-red-600">{groupError}</div>}
        </div>
      )}

      {lockStatus && !isLocked && (
        <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-amber-700">Predictions lock at 08:00 PM</span>
          <span className="text-sm font-mono font-semibold text-amber-800">{formatCountdown(lockStatus.secondsUntilLock)}</span>
        </div>
      )}
      {isLocked && (
        <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <span className="text-sm font-medium text-red-700">Predictions are locked. View the dashboard to track scores.</span>
        </div>
      )}

      <div className="mb-5 flex justify-end">
        <a href={`/admin/${year}`} className="text-[11px] text-gray-400 hover:text-gray-600 underline">Admin panel →</a>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        {TABS.map(tab => {
          const complete = tab === 'Bracket' ? bracketComplete : tab === 'Leaders' ? leadersComplete : tab === 'General' ? generalComplete : snacksComplete
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all relative ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab}{complete && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400" />}
            </button>
          )
        })}
      </div>

      {activeTab === 'Bracket' && <BracketTab bracket={fullBracket} predictions={bracketPreds} onChange={setBracketPreds} locked={isLocked} mvpPreds={mvpPreds} onMvpChange={setMvpPreds} eastPlayers={eastPlayers} westPlayers={westPlayers} allPlayers={allPlayers} />}
      {activeTab === 'Leaders' && <LeadersTab predictions={leaderPreds} onChange={setLeaderPreds} locked={isLocked} allPlayers={allPlayers} />}
      {activeTab === 'General' && <GeneralTab questions={seasonData.generalConfig?.questions ?? []} answers={generalAnswers} onChange={setGeneralAnswers} locked={isLocked} />}
      {activeTab === 'Snacks' && <SnacksTab questions={seasonData.snackQuestions} answers={snackAnswers} onChange={setSnackAnswers} locked={isLocked} />}

      {!isLocked && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200 p-4 z-50">
          <div className="max-w-3xl mx-auto">
            <button onClick={handleSubmit} disabled={!allComplete || submitStatus === 'saving'}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${allComplete ? (submitStatus === 'saved' ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]') : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
              {submitStatus === 'saving' ? 'Saving...' : submitStatus === 'saved' ? '✓ Saved!' : submitStatus === 'error' ? 'Error — try again' : !allComplete ? 'Complete all tabs to submit' : 'Submit predictions'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function BracketTab({ bracket, predictions, onChange, locked, mvpPreds, onMvpChange, eastPlayers, westPlayers, allPlayers }: {
  bracket: { east: BracketSeries[]; west: BracketSeries[]; finals: BracketSeries[] }
  predictions: Record<string, { winnerId: string; gameCount: number; leadingScorer: string }>
  onChange: (p: Record<string, any>) => void; locked: boolean
  mvpPreds: Record<string, string>; onMvpChange: (p: Record<string, string>) => void
  eastPlayers: string[]; westPlayers: string[]; allPlayers: string[]
}) {
  const roundNames: Record<number, string> = { 1: 'Round 1', 2: 'Conf. semis', 3: 'Conf. finals', 4: 'NBA Finals' }

  function updateSeries(seriesId: string, field: string, value: any) {
    if (locked) return
    const current = predictions[seriesId] ?? { winnerId: '', gameCount: 0, leadingScorer: '' }
    onChange({ ...predictions, [seriesId]: { ...current, [field]: value } })
  }

  const renderConference = (label: string, series: BracketSeries[], mvpKey: string, mvpPlayers: string[]) => (
    <div className="mb-8">
      <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-4">{label}</div>
      {[1, 2, 3].map(round => {
        const rs = series.filter(s => s.round === round)
        if (!rs.length) return null
        return (
          <div key={round} className="mb-6">
            <div className="text-[11px] font-semibold text-gray-500 mb-2 flex items-center gap-2">
              <div className="h-px flex-1 bg-gray-200" />{roundNames[round]}<div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="space-y-3">
              {rs.map(s => <SeriesCard key={s.id} series={s} prediction={predictions[s.id]} onUpdate={(f, v) => updateSeries(s.id, f, v)} locked={locked} />)}
            </div>
          </div>
        )
      })}
      {/* Conference MVP */}
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium text-amber-800">🏆 {label.replace(' Conference', '')} conference MVP</div>
          <span className="text-[10px] text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">10 pts</span>
        </div>
        <PlayerDropdown players={mvpPlayers} value={mvpPreds[mvpKey] ?? ''} onChange={val => !locked && onMvpChange({ ...mvpPreds, [mvpKey]: val })} disabled={locked} placeholder="Select MVP..." />
      </div>
    </div>
  )

  return (
    <div>
      {renderConference('Eastern Conference', bracket.east, 'eastMvp', eastPlayers)}
      {renderConference('Western Conference', bracket.west, 'westMvp', westPlayers)}
      {bracket.finals.length > 0 && (
        <div className="mb-8">
          <div className="text-[11px] font-semibold text-gray-500 mb-2 flex items-center gap-2">
            <div className="h-px flex-1 bg-yellow-300" /><span className="text-yellow-600">🏆 NBA Finals</span><div className="h-px flex-1 bg-yellow-300" />
          </div>
          {bracket.finals.map(s => <SeriesCard key={s.id} series={s} prediction={predictions[s.id]} onUpdate={(f, v) => updateSeries(s.id, f, v)} locked={locked} />)}
          {/* Finals MVP */}
          <div className="bg-yellow-50 rounded-xl border border-yellow-300 p-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-yellow-800">🏆 Finals MVP</div>
              <span className="text-[10px] text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">15 pts</span>
            </div>
            <PlayerDropdown players={allPlayers} value={mvpPreds.finalsMvp ?? ''} onChange={val => !locked && onMvpChange({ ...mvpPreds, finalsMvp: val })} disabled={locked} placeholder="Select Finals MVP..." />
          </div>
        </div>
      )}
    </div>
  )
}

function SeriesCard({ series, prediction, onUpdate, locked }: {
  series: BracketSeries; prediction?: { winnerId: string; gameCount: number; leadingScorer: string }
  onUpdate: (field: string, val: any) => void; locked: boolean
}) {
  const { homeTeam, awayTeam } = series
  if (!homeTeam || !awayTeam) {
    return (
      <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-4 text-center">
        <div className="text-xs text-gray-400">{series.label}</div>
        <div className="text-sm text-gray-500 mt-1">Pick winners above to unlock this matchup</div>
      </div>
    )
  }
  const winnerId = prediction?.winnerId ?? ''
  const m = ROUND_POINTS[(series.round - 1)] ?? 1
  const seriesPlayers = [...(PLAYOFF_PLAYERS[homeTeam.abbr] ?? []), ...(PLAYOFF_PLAYERS[awayTeam.abbr] ?? [])].sort()

  return (
    <div className={`bg-white rounded-xl border p-4 space-y-3 transition-all ${winnerId ? 'border-gray-200' : 'border-gray-200 border-dashed'}`}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium text-gray-400 tracking-wide">{series.label}</div>
        <div className="text-[10px] text-gray-400">Round {series.round} · {m}x multiplier</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[homeTeam, awayTeam].map(team => {
          const selected = winnerId === team.id
          return (
            <button key={team.id} onClick={() => !locked && onUpdate('winnerId', team.id)} disabled={locked}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${selected ? 'border-gray-900 bg-gray-900 text-white shadow-md' : 'border-gray-200 hover:border-gray-300 text-gray-700'} ${locked ? 'cursor-default' : 'cursor-pointer'}`}>
              <img src={TEAM_LOGOS[team.abbr] ?? DEFAULT_TEAM_LOGO} alt={`${team.abbr} logo`} className="w-6 h-6 rounded-full flex-shrink-0 bg-white p-0.5" />
              <div className="text-left">
                <div className="text-sm font-medium">{team.abbr}</div>
                <div className={`text-[11px] ${selected ? 'text-gray-300' : 'text-gray-400'}`}>#{team.seed}</div>
              </div>
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">Winner</div>
        <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{3 * m} pts</span>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs text-gray-500">Games</div>
          <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{2 * m} pts</span>
        </div>
        <div className="flex gap-1.5">
          {[4,5,6,7].map(g => (
            <button key={g} onClick={() => !locked && onUpdate('gameCount', g)} disabled={locked}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${prediction?.gameCount === g ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'} ${locked ? 'cursor-default' : 'cursor-pointer'}`}>{g}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs text-gray-500">Series leading scorer</div>
          <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{1 * m} pts</span>
        </div>
        <PlayerDropdown players={seriesPlayers} value={prediction?.leadingScorer ?? ''} onChange={val => !locked && onUpdate('leadingScorer', val)} disabled={locked} placeholder="Select player..." />
      </div>
      <div className="text-[10px] text-center text-gray-400 pt-1 border-t border-gray-100">
        All 3 correct = 1.5x bonus → {Math.floor((3 + 2 + 1) * m * 1.5)} pts max
      </div>
    </div>
  )
}

function PlayerDropdown({ players, value, onChange, disabled, placeholder }: {
  players: string[]; value: string; onChange: (val: string) => void; disabled: boolean; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const filtered = search ? players.filter(p => p.toLowerCase().includes(search.toLowerCase())) : players
  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick); return () => document.removeEventListener('mousedown', onClick)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => !disabled && setOpen(!open)} disabled={disabled}
        className={`w-full px-3 py-2 rounded-lg border text-left text-sm transition-all ${value ? 'border-gray-300 bg-white text-gray-900' : 'border-gray-200 bg-gray-50 text-gray-400'} ${disabled ? 'cursor-default' : 'cursor-pointer hover:border-gray-300'}`}>
        <div className="flex items-center gap-2">
          {value && (
            <img
              src={PLAYER_IMAGES[value] ?? DEFAULT_PLAYER_IMAGE}
              alt={value}
              className="w-6 h-6 rounded-full object-cover flex-shrink-0"
            />
          )}
          <span className="truncate">{value || placeholder || 'Select...'}</span>
        </div>
        <span className="float-right text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input type="text" placeholder="Search players..." value={search} onChange={e => setSearch(e.target.value)} autoFocus className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">No players found</div>}
            {filtered.map(p => (
              <button key={p} onClick={() => { onChange(p); setOpen(false); setSearch('') }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${value === p ? 'bg-gray-100 font-medium' : ''}`}>
                <img
                  src={PLAYER_IMAGES[p] ?? DEFAULT_PLAYER_IMAGE}
                  alt={p}
                  className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                />
                <span className="truncate">{p}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LeadersTab({ predictions, onChange, locked, allPlayers }: {
  predictions: Record<string, string>; onChange: (p: Record<string, string>) => void; locked: boolean; allPlayers: string[]
}) {
  return (
    <div className="space-y-4">
      <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">Playoff statistical leaders</div>
      <p className="text-xs text-gray-500 mb-4">Predict who will lead the entire playoffs in each category (min 8 games).</p>
      {LEADER_CATEGORIES.map(cat => (
        <div key={cat} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-gray-400">{cat} leader</div>
            <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">12 pts</span>
          </div>
          <PlayerDropdown players={allPlayers} value={predictions[cat] ?? ''} onChange={val => !locked && onChange({ ...predictions, [cat]: val })} disabled={locked} placeholder={`Select ${cat.toLowerCase()} leader...`} />
        </div>
      ))}
    </div>
  )
}

function GeneralTab({ questions, answers, onChange, locked }: {
  questions: GeneralQuestion[]; answers: Record<string, number>; onChange: (a: Record<string, number>) => void; locked: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">General predictions</div>
      <p className="text-xs text-gray-500 mb-4">Predict the exact number. Exact match required.</p>
      {questions.map(q => (
        <div key={q.key} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-700">{q.label}</div>
            <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">6 pts</span>
          </div>
          <input type="number" min={0} max={999} placeholder="0" value={answers[q.key] ?? ''}
            onChange={e => !locked && onChange({ ...answers, [q.key]: +e.target.value })} readOnly={locked}
            className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-lg font-semibold text-center bg-gray-50 focus:outline-none focus:border-gray-400" />
        </div>
      ))}
    </div>
  )
}

function SnacksTab({ questions, answers, onChange, locked }: {
  questions: SnackQuestion[]; answers: Record<number, boolean>; onChange: (a: Record<number, boolean>) => void; locked: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">Yes / No predictions</div>
      <p className="text-xs text-gray-500 mb-4">Quick-fire predictions.</p>
      {questions.map((q, i) => (
        <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-700"><span className="text-xs text-gray-400 mr-1.5">{i + 1}.</span>{q.question}</div>
            <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">2 pts</span>
          </div>
          <div className="flex gap-2">
            {[true, false].map(val => (
              <button key={String(val)} onClick={() => !locked && onChange({ ...answers, [q.id]: val })} disabled={locked}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${answers[q.id] === val ? (val ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'bg-gray-100 text-gray-500 hover:bg-gray-200'} ${locked ? 'cursor-default' : 'cursor-pointer'}`}>
                {val ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '0:00'
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}